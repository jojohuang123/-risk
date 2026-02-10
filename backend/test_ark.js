const ArkPkg = require('@volcengine/ark');
console.log('Type:', typeof ArkPkg);
console.log('Exports:', Object.keys(ArkPkg));
console.log('Ark property:', ArkPkg.Ark);
console.log('Default property:', ArkPkg.default);
if (typeof ArkPkg === 'function') console.log('It is a function/class itself');
