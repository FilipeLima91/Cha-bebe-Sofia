const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path'); // Para sendFile

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(express.json());
app.use(express.static('public'));
app.use(cors());

// Config Supabase (com fallback se env vars falharem)
let supabase;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Env vars Supabase não configuradas');
  }
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase conectado com sucesso! ✅');
} catch (err) {
  console.error('Erro ao conectar Supabase (usando fallback memória):', err.message);
  supabase = null;
}

// Fallback para memória se Supabase falhar
let fallbackData = {};

// Função readData (com Supabase ou fallback)
async function readData() {
  if (!supabase) {
    console.log('Usando fallback memória (Supabase indisponível)');
    return fallbackData;
  }
  try {
    const { data, error } = await supabase
      .from('items')
      .select('item_name, claimed_by');

    if (error) throw error;

    const result = {};
    data.forEach(row => {
      result[row.item_name] = row.claimed_by ? [row.claimed_by] : [];
    });

    console.log(`Carregados ${data.length} itens do Supabase.`);
    return result;
  } catch (err) {
    console.error('Erro ao ler Supabase, usando fallback:', err.message);
    return fallbackData;
  }
}

// Função saveClaim (com Supabase ou fallback)
async function saveClaim(item, name) {
  if (!supabase) {
    // Fallback memória
    if (fallbackData[item] && fallbackData[item].length > 0) {
      return { success: false, error: 'Item já reivindicado' };
    }
    fallbackData[item] = [name.trim()];
    console.log(`Fallback: Item "${item}" reivindicado por "${name}"`);
    return { success: true };
  }

  try {
    // Verifica se já reivindicado
    const { data: existing, error: checkError } = await supabase
      .from('items')
      .select('claimed_by')
      .eq('item_name', item)
      .single();

    if (checkError && checkError.code !== 'PGRST116') throw checkError; // 404 ok

    if (existing && existing.claimed_by) {
      return { success: false, error: 'Item já reivindicado' };
    }

    // Upsert (cria ou atualiza)
    const { data, error } = await supabase
      .from('items')
      .upsert({ item_name: item, claimed_by: name.trim() }, { onConflict: 'item_name' })
      .select();

    if (error) throw error;

    console.log(`Supabase: Item "${item}" reivindicado por "${name}"`);
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao salvar Supabase, usando fallback:', err.message);
    // Fallback salva em memória
    fallbackData[item] = [name.trim()];
    return { success: true };
  }
}

// Config Nodemailer (CORRIGIDO: createTransport, com fallback)
let transporter;
try {
  transporter = nodemailer.createTransport({  // FIX: createTransport (não createTransporter)
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'fallback@email.com',
      pass: process.env.EMAIL_PASS || 'fallback',
    },
  });
  transporter.verify((error, success) => {
    if (error) {
      console.error('Config de email falhou (continua sem email):', error.message);
    } else {
      console.log('Servidor de email (Gmail) configurado corretamente! ✅');
    }
  });
} catch (err) {
  console.error('Nodemailer falhou (continua sem email):', err.message);
  transporter = null;
}

// Endpoint POST /api/submit
app.post('/api/submit', async (req, res) => {
  try {
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
        }
      }
    }

    if (!hasChanges) {
      return res.status(200).json({ 
        message: 'Nenhum item disponível foi reivindicado (todos já tomados).', 
        alreadyClaimed 
      });
    }

    // Envia email se configurado
    if (claimedItems.length > 0 && transporter) {
      const emailText = claimedItems.join('\n');
      const mailOptions = {
        from: process.env.EMAIL_USER || 'no-reply@site.com',
        to: process.env.EMAIL_USER || 'no-reply@site.com',
        subject: 'Novo nome registrado no Chá de Bebê da Sofia! 🎉',
        text: `Olá! Novos nomes foram registrados na lista:\n\n${emailText}\n\nItens já tomados: ${alreadyClaimed.join(', ') || 'Nenhum'}\n\nAcesse o site para ver a lista completa.\n\nCom carinho, Sofia 💕`,
        html: `<h2>Novos nomes no Chá de Bebê da Sofia!</h2><p><strong>Itens registrados:</strong></p><pre style="background: #f9f9f9; padding: 10px; border-radius: 5px;">${emailText.replace(/\n/g, '<br>')}</pre><p><strong>Já tomados:</strong> ${alreadyClaimed.join(', ') || 'Nenhum'}</p><p>💕 Beijos da futura mamãe!</p>`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Erro ao enviar email:', error);
        } else {
          console.log('Email enviado com sucesso via Gmail:', info.messageId);
        }
      });
    } else {
      console.log('Email pulado (não configurado).');
    }

    res.status(200).json({ 
      message: 'Itens reivindicados com sucesso!', 
      claimedItems,
      alreadyClaimed 
    });
  } catch (err) {
    console.error('Erro no /api/submit:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint GET /api/names
app.get('/api/names', async (req, res) => {
  try {
    const claimedData = await readData();
    res.json(claimedData);
  } catch (err) {
    console.error('Erro no /api/names:', err);
    res.status(500).json({ error: 'Erro ao carregar nomes' });
  }
});

// Servir o frontend na raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('Sistema com Supabase + fallback memória ativo!');
});