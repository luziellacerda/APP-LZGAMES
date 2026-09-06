const fs = require('node:fs');
const path = require('node:path');
const app = require('../app.json').expo;
const file = process.env.GOOGLE_SERVICES_JSON || path.join(__dirname, '..', 'google-services.json');
if (!fs.existsSync(file)) {
  console.error('PENDENTE: google-services.json do Firebase para br.com.lzgames.app. Não envie uma compilação de produção sem configurar o push. Consulte docs/NOTIFICACOES-PUSH.md.');
  process.exitCode = 1;
} else {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed.client?.some(client => client.client_info?.android_client_info?.package_name === app.android.package) || !parsed.project_info?.project_number) {
    console.error('Firebase incompatível com o pacote Android do app.');
    process.exitCode = 1;
  } else {
    console.log('Configuração local Firebase válida. Confirme também a credencial FCM V1 no EAS; este teste não comprova entrega a um celular.');
  }
}
