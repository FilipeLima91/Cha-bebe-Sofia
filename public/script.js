const form = document.getElementById('giftForm');
const resultsContainer = document.getElementById('resultsContainer');
const submitButton = form.querySelector('button[type="submit"]');
const displayName = claimed_by && claimed_by !== 'undefined' ? claimed_by : 'disponível';

// Função para esconder itens já reivindicados (chamada após envio para atualizar form)
function hideClaimedItems(data) {
  const itemRows = document.querySelectorAll('.item-row');
  itemRows.forEach(row => {
    const input = row.querySelector('.input-name');
    if (input && Array.isArray(data[input.name]) && data[input.name].length > 0) {
      row.style.display = 'none';
      console.log('DEBUG: Escondendo item reivindicado:', input.name);
    } else if (input && !data[input.name]) {
      row.style.display = 'flex';
    }
  });
}

// Função para carregar histórico completo (só quando solicitado)
async function fetchAllNames() {
  try {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #a85a7a;">Carregando histórico completo...</p>';
    const res = await fetch('/api/names');
    if (!res.ok) {
      throw new Error('Erro na resposta do servidor');
    }
    const data = await res.json();
    resultsContainer.innerHTML = '';

    if (Object.keys(data).length === 0) {

      for (const key in data) {
        if (!Array.isArray(data[key]) || data[key].length === 0) {
          delete data[key];
        }
      }

      resultsContainer.innerHTML = '<p style="text-align: center; color: #a85a7a; font-style: italic;">Nenhum item reivindicado ainda. Seja o primeiro! 💕</p>';
      return data;
    }

    // Mostra todos os reivindicados
    for (const [item, names] of Object.entries(data)) {
  // Corrigido: ignora null, undefined, strings vazias e arrays vazios
  const validName = Array.isArray(names) && names.length > 0 && names[0] ? names[0] : null;
  if (!validName) continue;

  const div = document.createElement('div');
  div.style.marginBottom = '1rem';
  div.style.padding = '0.8rem';
  div.style.backgroundColor = '#fff8f8';
  div.style.borderRadius = '8px';
  div.style.borderLeft = '4px solid #f8c8d8';
  div.innerHTML = `
    <strong style="color: #a85a7a;">${item}:</strong> 
    <span style="color: #7a3e5a; font-weight: bold;">Reivindicado por ${validName} 🎉</span>
  `;
  resultsContainer.appendChild(div);
}


    hideClaimedItems(data);
    return data;
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    resultsContainer.innerHTML = '<p style="text-align: center; color: #a85a7a;">Erro ao carregar histórico. 🔄</p>';
    return {};
  }
}

// Função para mostrar APENAS os itens recém-reivindicados (do envio atual)
function showRecentClaims(claimedItems) {
  console.log('DEBUG: showRecentClaims chamado com:', claimedItems);

  resultsContainer.innerHTML = '<h3 style="color: #a85a7a;">Lista de Nomes Registrados 🎉</h3>';

  if (!claimedItems || claimedItems.length === 0) {
    console.log('DEBUG: Nenhum item reivindicado');
    resultsContainer.innerHTML += '<p style="text-align: center; color: #a85a7a; font-style: italic;">Nenhum item foi reivindicado neste envio.</p>';
    return;
  }

  claimedItems.forEach(itemStr => {
    console.log('DEBUG: Processando:', itemStr);
    const parts = itemStr.split(': ');
    const item = parts[0];
    const name = parts.slice(1).join(': ');

    const div = document.createElement('div');
    div.style.marginBottom = '1rem';
    div.style.padding = '0.8rem';
    div.style.backgroundColor = '#fff8f8';
    div.style.borderRadius = '8px';
    div.style.borderLeft = '4px solid #f8c8d8';
    div.innerHTML = `
      <strong style="color: #a85a7a;">${item}:</strong> 
      <span style="color: #7a3e5a; font-weight: bold;">Reivindicado por ${name} 🎉</span>
    `;
    resultsContainer.appendChild(div);
  });

  // Botão para histórico
  const button = document.createElement('button');
  button.textContent = 'Ver Todos os Reivindicados';
  button.style.marginTop = '1rem';
  button.style.backgroundColor = '#f8c8d8';
  button.style.border = 'none';
  button.style.padding = '0.5rem 1rem';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.style.color = '#7a3e5a';
  button.onclick = () => fetchAllNames();
  resultsContainer.appendChild(button);
}

// Função handleSubmit (mostra apenas novos e atualiza form)
async function handleSubmit(e) {
  e.preventDefault();

  const formData = new FormData(form);
  const entries = {};
  for (const [key, value] of formData.entries()) {
    if (value.trim() !== '') {
      entries[key] = value.trim();
    }
  }

  if (Object.keys(entries).length === 0) {
    alert('Por favor, preencha pelo menos um nome para reivindicar itens! 🌸');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Reivindicando... 💌';
  submitButton.style.backgroundColor = '#a85a7a';
  submitButton.style.color = 'white';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entries),
    });

    const response = await res.json();
    console.log('DEBUG: Resposta da API:', response);

    if (res.ok) {
      let successMsg = 'Itens reivindicados com sucesso! ';
      if (response.claimedItems && response.claimedItems.length > 0) {
        successMsg += `Reivindicados: ${response.claimedItems.join(', ')}. `;
        showRecentClaims(response.claimedItems); // MOSTRA APENAS OS NOVOS NA SEÇÃO
      }
      if (response.alreadyClaimed && response.alreadyClaimed.length > 0) {
        successMsg += `Itens já tomados: ${response.alreadyClaimed.join(', ')}.`;
      }
      alert(successMsg + ' 🎉');

      form.reset();

      // ATUALIZA O FORM (esconde itens tomados) SEM MOSTRAR HISTÓRICO NA SEÇÃO
      try {
        const data = await fetch('/api/names').then(r => r.json());
        hideClaimedItems(data);
      } catch (err) {
        console.error('Erro ao atualizar form:', err);
      }
    } else {
      alert(`Erro ao reivindicar: ${response.error || 'Tente novamente.'} 😔`);
    }
  } catch (err) {
    console.error('Erro na conexão:', err);
    alert('Erro na conexão com o servidor. Verifique sua internet e tente novamente. 📡');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Reivindicar';
    submitButton.style.backgroundColor = '#f8c8d8';
    submitButton.style.color = '#7a3e5a';
  }
}

// Adiciona event listener
form.addEventListener('submit', handleSubmit);

// NÃO CARREGA NADA INICIALMENTE – SEÇÃO COMEÇA VAZIA