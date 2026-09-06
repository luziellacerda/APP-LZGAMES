const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const firebaseFile = process.env.GOOGLE_SERVICES_JSON || path.join(__dirname, 'google-services.json');
  const configured = fs.existsSync(firebaseFile);
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !configured) {
    throw new Error('Push Android não configurado: adicione google-services.json ou a variável de arquivo GOOGLE_SERVICES_JSON no EAS. Consulte docs/NOTIFICACOES-PUSH.md.');
  }
  if (configured) {
    const firebase = JSON.parse(fs.readFileSync(firebaseFile, 'utf8'));
    const matches = firebase.client?.some(client => client.client_info?.android_client_info?.package_name === config.android?.package);
    if (!matches || !firebase.project_info?.project_number) throw new Error('google-services.json não pertence ao pacote Android br.com.lzgames.app.');
  }
  return {
    ...config,
    android: { ...config.android, ...(configured ? { googleServicesFile: firebaseFile } : {}) },
  };
};
