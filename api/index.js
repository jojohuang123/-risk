const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI Client for Volcengine Ark
const client = new OpenAI({
    apiKey: process.env.ARK_API_KEY,
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
});

const app = express();
const port = 3000;

// Configure CORS
app.use(cors());

// Configure Multer for file uploads
// Use MemoryStorage for Vercel/Serverless environments
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'WeChat Moments AI Analysis Backend is running' });
});

// Analyze endpoint
app.post('/api/analyze', (req, res, next) => {
    // Note: Vercel serverless functions have a 4.5MB payload limit by default.
    // We are using memoryStorage, so large files might hit memory limits or timeouts.
    // For production, we should handle this gracefully or suggest fewer images.
    upload.array('images', 5)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: '文件上传错误: ' + err.message });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, async (req, res) => {
    if (!req.files || req.files.length < 2) {
        return res.status(400).json({ success: false, message: '请至少上传 2 张图片' });
    }

    try {
        console.log(`Received ${req.files.length} images for analysis.`);

        // 1. Prepare messages with images for the model
        const contentParts = [
            { 
                type: 'text', 
                text: `你是一位拥有“透视眼”的趣味情感分析师，人设是“幽默、犀利但心地善良的毒舌闺蜜”。
                
请仔细“审视”我上传的这些朋友圈截图，把它们当作“呈堂证供”。你的任务是基于这些视觉证据，挖掘出目标人物隐藏的性格特质和潜在的“情感风险”。

**分析风格要求：**
1. **趣味手绘风文案**：语气要轻松、调皮，像是在咖啡馆里和闺蜜聊八卦。多用网络热梗和生动的比喻。
2. **拒绝说教**：不要一本正经的心理学分析，要把专业观察转化为“吐槽”和“神预言”。
3. **可爱但犀利**：虽然风格可爱，但看人要准！直击灵魂。

**请务必以纯 JSON 格式输出结果，不要包含 markdown 代码块标记，直接返回 JSON 字符串。**
JSON 数据结构必须严格如下：

{
  "danger_index": 4.5, // 0.0 - 5.0，表示“危险/渣”的程度，越高越危险
  "danger_level": "海王潜力股 / 纯情小白兔 / 中央空调", // 简短有趣的评级标签
  "warning_message": "警报！此人朋友圈含鱼量过高，请携带氧气瓶入场！", // 一句扎心的风险提示
  "toxic_traits": [ // 3个最明显的“槽点”
    { "trait": "仅三天可见", "roast": "是有什么不可告人的秘密，还是在躲避前任追杀？" },
    { "trait": "全是自拍", "roast": "手机里大概存了800张同一角度的照片，自恋指数爆表。" },
    { "trait": "深夜EMO", "roast": "一到晚上就网抑云，是想钓鱼还是真的伤感？" }
  ],
  "mbti_guess": {
    "type": "ENFP (快乐小狗)",
    "roast": "看起来人畜无害，其实内心戏比甄嬛传还多，随时准备为了自由离家出走。"
  },
  "appearance_roast": "这一身穿搭，仿佛在说：‘快来看我，但我很高贵，你高攀不起’。眼镜是本体，摘了可能没人认识。",
  "survival_guide": "如果一定要和Ta相处，建议下载反诈APP，并且时刻保持清醒，不要被Ta的甜言蜜语忽悠瘸了。"
}
` 
            }
        ];

        // 2. Read image files and convert to base64
        for (const file of req.files) {
            // With MemoryStorage, file.buffer contains the data
            const base64Image = file.buffer.toString('base64');
            
            // Determine mime type roughly or use file.mimetype
            const mimeType = file.mimetype || 'image/jpeg';

            contentParts.push({
                type: 'image_url',
                image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                }
            });
        }

        // 3. Call the model
        console.log('Calling Doubao model...');
        const completion = await client.chat.completions.create({
            model: process.env.ARK_MODEL_ID,
            messages: [
                {
                    role: 'user',
                    content: contentParts
                }
            ],
            temperature: 0.8, // Increase temperature slightly for more creativity and humor
            // Ensure JSON output if supported, otherwise we rely on prompt
            // response_format: { type: 'json_object' } // Check if model supports this
        });

        console.log('Model response received.');
        
        // 4. Parse response
        let aiContent = completion.choices[0].message.content;
        
        // Clean up markdown code blocks if present
        aiContent = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();

        let parsedResult;
        try {
            parsedResult = JSON.parse(aiContent);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.log('Raw content:', aiContent);
            // Fallback or retry logic could go here
            return res.status(500).json({ success: false, message: 'AI 生成格式解析失败', raw: aiContent });
        }

        // 5. Cleanup - No need to cleanup files with MemoryStorage as they are in memory

        res.json({ success: true, data: parsedResult });

    } catch (error) {
        console.error('Analysis Error:', error);
        res.status(500).json({ success: false, message: '服务器内部错误: ' + error.message });
    }
});

// Export app for Vercel
module.exports = app;

// Only listen if run directly (not imported as a module)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Backend server running at http://localhost:${port}`);
    });
}
