import { useState, useEffect } from 'react'
import { Button, Uploader, Toast, NoticeBar, Steps } from 'react-vant'
import { Photograph, Warning } from '@react-vant/icons'
import axios from 'axios'
import './App.css'

// Define types for the analysis result
interface AnalysisResult {
  danger_index: number;
  danger_level: string;
  warning_message: string;
  toxic_traits: Array<{ trait: string; roast: string }>;
  mbti_guess: {
    type: string;
    roast: string;
  };
  appearance_roast: string;
  survival_guide: string;
}

function App() {
  const [fileList, setFileList] = useState<any[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loadingStep, setLoadingStep] = useState(0)

  // Loading animation effect
  useEffect(() => {
    let interval: any;
    if (analyzing) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [analyzing]);

  // Image compression helper
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension 1024px
          const MAX_SIZE = 1024;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob failed'));
            }
          }, 'image/jpeg', 0.7); // Compress to JPEG with 0.7 quality
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (fileList.length < 2) {
      Toast.fail('为了准确分析，请至少上传 2 张截图')
      return
    }

    setAnalyzing(true)
    setResult(null)

    try {
      const formData = new FormData()
      
      // Compress and append images
      const compressPromises = fileList.map(async (item) => {
        if (item.file) {
          try {
            const compressedBlob = await compressImage(item.file);
            formData.append('images', compressedBlob, item.file.name);
          } catch (e) {
            console.error('Compression failed for file:', item.file.name, e);
            // Fallback to original if compression fails
            formData.append('images', item.file);
          }
        }
      });

      await Promise.all(compressPromises);

      // In production (Vercel), we use relative path to route through vercel.json rewrites
      // In development, we use VITE_API_URL or default to localhost:3000
      const apiUrl = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3000');
      
      const response = await axios.post(`${apiUrl}/api/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000,
      })

      if (response.data && response.data.success) {
        setResult(response.data.data)
      } else {
        Toast.fail('分析失败: ' + (response.data.message || '未知错误'))
      }
    } catch (error: any) {
      console.error(error)
      const status = error.response?.status;
      const serverMsg = error.response?.data?.message || error.message;
      
      let userMsg = '网络请求失败，请稍后重试';
      if (status === 413) userMsg = '图片总大小太大，请减少图片数量或截图范围';
      if (status === 504) userMsg = 'AI 思考太久超时了，请重试';
      if (status === 500) userMsg = '服务器出错了，可能是 API Key 没配置';
      
      Toast.fail(`${userMsg} (${status || 'Error'}: ${serverMsg})`);
    } finally {
      setAnalyzing(false)
    }
  }

  const reset = () => {
    setFileList([])
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-container">
      {/* Header Background */}
      <div className="header-bg"></div>

      <div className="content-wrapper">
        {!result ? (
          <div className="upload-section fade-in">
            <div className="hero-text">
              <h1>AI 情感鉴定所</h1>
              <p>趣味·毒舌·神准的 AI 闺蜜</p>
            </div>

            <div className="card upload-card">
              <NoticeBar 
                leftIcon={<Warning />} 
                text="仅供娱乐，上传照片后自动销毁，AI 嘴毒请轻喷~"  
                color="#2d3436"
                background="#dfe6e9"
                style={{ marginBottom: '16px', borderRadius: '8px', border: '1px dashed #b2bec3' }}
              />

              <div className="upload-area">
                <Uploader
                  value={fileList}
                  onChange={setFileList}
                  multiple
                  maxCount={5}
                  accept="image/*"
                  uploadIcon={<Photograph fontSize={40} color="#b2bec3" />}
                />
                <div className="upload-hint">
                  {fileList.length === 0 ? (
                    <p>📸 点这里上传 Ta 的朋友圈<br/><span>(来个 2-5 张，让 AI 看看 Ta 是人是鬼)</span></p>
                  ) : (
                    <p>已捕捉 {fileList.length} 张证据 🕵️‍♀️</p>
                  )}
                </div>
              </div>

              <div className="action-area">
                <Button 
                  type="primary" 
                  round 
                  block 
                  size="large" 
                  className="analyze-btn"
                  onClick={handleAnalyze}
                  loading={analyzing}
                  loadingText="AI 正在吃瓜中..."
                  disabled={fileList.length < 2}
                >
                  开始吃瓜分析 🍉
                </Button>
              </div>
            </div>

            {analyzing && (
              <div className="loading-state">
                <Steps active={loadingStep} direction="vertical" activeColor="#ff9f43">
                  <Steps.Item>👀 正在偷看朋友圈...</Steps.Item>
                  <Steps.Item>🧠 运用毕生绝学分析中...</Steps.Item>
                  <Steps.Item>📝 正在组织吐槽语言...</Steps.Item>
                  <Steps.Item>✨ 报告生成中...</Steps.Item>
                </Steps>
              </div>
            )}
          </div>
        ) : (
          <div className="result-section slide-up">
            <div className="result-header">
              <h2>✨ 鉴定报告 ✨</h2>
            </div>

            {/* Danger Index Card - Fun Meter */}
            <div className="card danger-card">
              <div className="danger-header">
                <span className="danger-title">💥 渣渣指数</span>
              </div>
              
              <div className="danger-meter-container">
                <div className="hand-drawn-meter">
                  <div 
                    className="meter-fill" 
                    style={{ width: `${(result.danger_index || 0) * 20}%` }}
                  ></div>
                </div>
                <div className="danger-score">
                  {result.danger_index?.toFixed(1) || '0.0'}
                </div>
                <div className="danger-level-badge">{result.danger_level || '未知生物'}</div>
              </div>

              <div className="danger-warning">
                {result.warning_message || '暂无风险提示'}
              </div>
            </div>

            {/* Toxic Traits Card */}
            <div className="card toxic-card">
              <div className="card-title">🚩 槽点满满</div>
              <div className="toxic-list">
                {result.toxic_traits?.map((item, index) => (
                  <div key={index} className="toxic-item">
                    <div className="toxic-tag">{item.trait}</div>
                    <div className="toxic-roast">“{item.roast}”</div>
                  </div>
                ))}
              </div>
            </div>

            {/* MBTI Roast Card */}
            <div className="card mbti-card">
              <div className="card-title">🧩 MBTI 瞎猜</div>
              <div className="mbti-content">
                <div className="mbti-badge">{result.mbti_guess?.type}</div>
                <div className="mbti-desc">{result.mbti_guess?.roast}</div>
              </div>
            </div>

            {/* Appearance Roast */}
            <div className="card appearance-card">
              <div className="card-title">👗 穿搭点评</div>
              <div className="appearance-content">
                  <div className="appearance-text">
                    {result.appearance_roast}
                  </div>
              </div>
            </div>

            {/* Survival Guide */}
            <div className="card guide-card">
              <div className="card-title tips-title">🆘 只有闺蜜才告诉你的</div>
              <div className="guide-content">
                 {result.survival_guide}
              </div>
            </div>

            <div className="footer-action">
              <Button plain type="primary" round block size="large" onClick={reset}>
                换个人测测 🔄
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
