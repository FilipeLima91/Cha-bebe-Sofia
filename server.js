const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const cors = require('cors'); // Para permitir requisições de outros domínios, se necessário

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public')); // Pasta onde estarão index.html, styles.css e script.js
app.use(cors()); // Habilita CORS (opcional, mas útil para testes)

const DATA_FILE = path.join(__dirname, 'names.json');

// Função para ler dados do JSON
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler dados:', err);
    return {};
  }
}

// Função para salvar dados no JSON
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Erro ao salvar dados:', err);
    return false;
  }
}

// Configurar Nodemailer para Gmail
// IMPORTANTE: Use uma "senha de app" (não a senha normal da conta).
// 1. Ative 2FA em myaccount.google.com > Segurança > Verificação em duas etapas.
// 2. Vá em Segurança > Senhas de app > Gere uma para "Correio" ou "Outro".
// 3. Substitua 'seuemail@gmail.com' e 'sua-senha-de-app-do-gmail' abaixo.
 const transporter = nodemailer.createTransport({
       service: 'gmail',
       auth: {
         user: process.env.EMAIL_USER || 'aldrye34@gmail.com',        // Pega do ambiente ou fallback
         pass: process.env.EMAIL_PASS || 'uywm uybi wicg ptmg', // Pega do ambiente ou fallback (para testes locais)
       },
     });

// Teste o email (opcional: rode uma vez para verificar config)
transporter.verify((error, success) => {
  if (error) {
    console.error('Erro na configuração de email:', error);
    console.log('Dica: Verifique a senha de app no Google e ative 2FA. Certifique-se de que o email está correto.');
  } else {
    console.log('Servidor de email (Gmail) configurado corretamente! ✅');
  }
});

// Endpoint para receber submissão (POST /api/submit)
app.post('/api/submit', (req, res) => {
  const newEntries = req.body; // { "item": "nome", ... }
  
  if (!newEntries || Object.keys(newEntries).length === 0) {
    return res.status(400).json({ error: 'Nenhum dado enviado' });
  }

  const data = readData();
  const claimedItems = []; // Itens que foram reivindicados com sucesso
  const alreadyClaimed = []; // Itens já tomados
  let hasChanges = false;

  // Processa cada entrada: permite APENAS UM nome por item (exclusivo)
  for (const [item, name] of Object.entries(newEntries)) {
    const trimmedName = name.trim();
    if (trimmedName) {
      if (data[item] && data[item].length > 0) {
        // Item já reivindicado: ignora e avisa
        alreadyClaimed.push(item);
        console.log(`Item "${item}" já reivindicado por "${data[item][0]}" - ignorado.`);
      } else {
        // Item disponível: reivindica com UM nome
        data[item] = [trimmedName]; // Array com apenas um nome
        claimedItems.push(`${item}: ${trimmedName}`);
        hasChanges = true;
        console.log(`Item "${item}" reivindicado por "${trimmedName}"`);
      }
    }
  }

  if (!hasChanges) {
    // Nenhum item novo foi adicionado
    return res.status(200).json({ 
      message: 'Nenhum item disponível foi reivindicado (todos já tomados).', 
      alreadyClaimed: alreadyClaimed 
    });
  }

  // Salva os dados
  if (!saveData(data)) {
    return res.status(500).json({ error: 'Falha ao salvar dados no servidor' });
  }

  // Prepara o email apenas para itens novos reivindicados
  const emailText = claimedItems.join('\n');
  if (claimedItems.length > 0) {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'aldrye34@gmail.com', // Substitua pelo seu Gmail real (remetente)
      to: process.env.EMAIL_USER || 'aldrye34@gmail.com',   // Substitua pelo seu Gmail real (destinatário) - pode ser o mesmo
      subject: 'Novos itens reivindicados no Chá de Bebê da Sofia! 🎉',
      text: `Olá! Novos itens foram reivindicados:\n\n${emailText}\n\nItens já tomados: ${alreadyClaimed.join(', ') || 'Nenhum'}\n\nAcesse o site para ver a lista completa.\n\nCom carinho, Sofia 💕`,
      html: `<h2>Novos itens no Chá de Bebê da Sofia!</h2><p><strong>Reivindicados:</strong></p><pre style="background: #f9f9f9; padding: 10px; border-radius: 5px;">${emailText.replace(/\n/g, '<br>')}</pre><p><strong>Já tomados:</strong> ${alreadyClaimed.join(', ') || 'Nenhum'}</p><p>💕 Beijos da futura mamãe!</p>`,
    };

    // Envia email de forma assíncrona
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Erro ao enviar email:', error);
      } else {
        console.log('Email enviado com sucesso via Gmail:', info.messageId);
      }
    });
  }

  res.status(200).json({ 
    message: 'Itens reivindicados com sucesso!', 
    claimedItems: claimedItems,
    alreadyClaimed: alreadyClaimed 
  });
});

// Endpoint para obter nomes salvos (GET /api/names)
app.get('/api/names', (req, res) => {
  const data = readData();
  res.json(data);
});

// Servir o frontend na raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('Acesse o site e teste o formulário! Itens agora são exclusivos.');
});