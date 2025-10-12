const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js'); // Cliente Supabase

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(express.json());
app.use(express.static('public'));
app.use(cors());

// Config Supabase (use env vars no Vercel)
const supabaseUrl = process.env.SUPABASE_URL || 'https://ohzcmdmkeqabdcnurueh.supabase.co'; // Substitua ou use env
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oemNtZG1rZXFhYmRjbnVydWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTAwMjgsImV4cCI6MjA3NTg2NjAyOH0.YC8LwewsQAqoMjNx5jQMBhrEFv3VRyaBVghjjgqCkOw'; // Substitua ou use env
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Config Nodemailer (mesmo de antes)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'aldrye34@gmail.com',
    pass: process.env.EMAIL_PASS || 'uywmuybiwicgptmg',
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('Erro na configuração de email:', error);
  } else {
    console.log('Servidor de email (Gmail) configurado corretamente! ✅');
  }
});

// Função para ler itens reivindicados do Supabase
async function readData() {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('item_name, claimed_by')
      .eq('claimed_by', null); // Pega só disponíveis? Não, pega todos para verificar

    if (error) throw error;

    // Retorna mapa { item_name: [claimed_by] } ou vazio se null
    const result = {};
    data.forEach(row => {
      if (row.claimed_by) {
        result[row.item_name] = [row.claimed_by];
      }
    });

    // Adiciona itens disponíveis (não reivindicados) como vazio
    // Nota: Para itens disponíveis, assumimos que estão na tabela com claimed_by NULL
    // Se quiser pré-popular todos os itens, rode um INSERT inicial no Supabase dashboard
    return result;
  } catch (err) {
    console.error('Erro ao ler do Supabase:', err);
    return {};
  }
}

// Função para salvar/claim no Supabase
async function saveClaim(item, name) {
  try {
    // Primeiro, verifica se já reivindicado
    const { data: existing, error: checkError } = await supabase
      .from('items')
      .select('claimed_by')
      .eq('item_name', item)
      .single();

    if (checkError && checkError.code !== 'PGRST116') throw checkError; // 404 é ok (não existe)

    if (existing && existing.claimed_by) {
      return { success: false, error: 'Item já reivindicado' };
    }

    // Se não existe, cria o item com claimed_by = name
    const { data, error } = await supabase
      .from('items')
      .upsert({ item_name: item, claimed_by: name.trim() }, { onConflict: 'item_name' })
      .select();

    if (error) throw error;

    console.log(`Item "${item}" reivindicado por "${name}" no Supabase.`);
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao salvar no Supabase:', err);
    return { success: false, error: err.message };
  }
}

// Endpoint POST /api/submit
app.post('/api/submit', async (req, res) => {
  const newEntries = req.body;
  
  if (!newEntries || Object.keys(newEntries).length === 0) {
    return res.status(400).json({ error: 'Nenhum dado enviado' });
  }

  const claimedItems = [];
  const alreadyClaimed = [];
  let hasChanges = false;

  for (const [item, name] of Object.entries(newEntries)) {
    const trimmedName = name.trim();
    if (trimmedName) {
      const result = await saveClaim(item, trimmedName);
      if (result.success) {
        claimedItems.push(`${item}: ${trimmedName}`);
        hasChanges = true;
      } else {
        alreadyClaimed.push(item);
        console.log(`Item "${item}" já reivindicado - ignorado.`);
      }
    }
  }

  if (!hasChanges) {
    return res.status(200).json({ 
      message: 'Nenhum item disponível foi reivindicado.', 
      alreadyClaimed 
    });
  }

  // Email para itens reivindicados
  if (claimedItems.length > 0) {
    const emailText = claimedItems.join('\n');
    const mailOptions = {
      from: process.env.EMAIL_USER || 'aldrye34@gmail.com',
      to: process.env.EMAIL_USER || 'aldrye34@gmail.com',
      subject: 'Novos itens reivindicados no Chá de Bebê da Sofia! 🎉',
      text: `Olá! Novos itens foram reivindicados:\n\n${emailText}\n\nItens já tomados: ${alreadyClaimed.join(', ') || 'Nenhum'}\n\nCom carinho, Sofia 💕`,
      html: `<h2>Novos itens no Chá de Bebê da Sofia!</h2><p><strong>Reivindicados:</strong></p><pre style="background: #f9f9f9; padding: 10px; border-radius: 5px;">${emailText.replace(/\n/g, '<br>')}</pre><p><strong>Já tomados:</strong> ${alreadyClaimed.join(', ') || 'Nenhum'}</p><p>💕 Beijos da futura mamãe!</p>`,
    };

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
    claimedItems,
    alreadyClaimed 
  });
});

// Endpoint GET /api/names (lê reivindicados do Supabase)
app.get('/api/names', async (req, res) => {
  const claimedData = await readData();
  res.json(claimedData);
});

// Servir frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('Usando Supabase para persistência de dados! ✅');
});