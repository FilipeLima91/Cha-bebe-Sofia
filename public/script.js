const form = document.getElementById('giftForm');
const resultsContainer = document.getElementById('resultsContainer');
const submitButton = form.querySelector('button[type="submit"]');

// Função para esconder itens já reivindicados (mesma de antes)
function hideClaimedItems(data) {
  const itemRows = document.querySelectorAll('.item-row');
  itemRows.forEach(row => {
    const input = row.querySelector('.input-name');
    if (input && data[input.name] && data[input.name].length > 0) {
      row.style.display = 'none';
    } else if (input && !data[input.name]) {
      row.style.display = 'flex';
    }
  });
}

// Função para carregar TODOS os itens reivindicados (histórico completo - só quando solicitado)
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
      resultsContainer.innerHTML = '<p style="text-align: center; color: #a85a7a; font-style: italic;">Nenhum item reivindicado ainda. Seja o primeiro! 💕</p>';
      return data;
    }
    
    for (const [item, names] of Object.entries(data)) {
      const div = document.createElement('div');
      div.style.marginBottom = '1rem';
      div.style.padding = '0.8rem';
      div.style.backgroundColor = '#fff8f8';
      div.style.borderRadius = '8px';
      div.style.borderLeft = '4px solid #f8c8d8';
      div.innerHTML = `
        <strong style="color: #a85a7a;">${item}:</strong> 
        <span style="color: #7a3e5a; font-weight: bold;">Reivindicado por ${names[0]} 🎉</span>
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
  console.log('DEBUG: showRecentClaims chamado com:', claimedItems); // LOG PARA DEBUG
  
  // Limpa a seção e adiciona título
  resultsContainer.innerHTML = '<h3 style="color: #a85a7a;">Lista de Nomes Registrados 🎉</h3>';
  
  if (!claimedItems || claimedItems.length === 0) {
    console.log('DEBUG: Nenhum item reivindicado ou array vazio'); // LOG PARA DEBUG
    resultsContainer.innerHTML += '<p style="text-align: center; color: #a85a7a; font-style: italic;">Nenhum item foi reivindicado neste envio.</p>';
    return;
  }
  
  // Processa cada item reivindicado
  claimedItems.forEach(itemStr => {
    console.log('DEBUG: Processando itemStr:', itemStr); // LOG PARA DEBUG
    const parts = itemStr.split(': '); // Divide em item e nome
    const item = parts[0];
    const name = parts.slice(1).join(': '); // Junta se houver ":" no nome
    console.log('DEBUG: Item:', item, 'Name:', name); // LOG PARA DEBUG
    
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
  
  // Adiciona botão para ver histórico completo
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

// Função handleSubmit (com logs extras para debug)
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
    console.log('DEBUG: Resposta completa da API:', response); // LOG PARA DEBUG
    
    if (res.ok) {
      let successMsg = 'Itens reivindicados com sucesso! ';
      if (response.claimedItems && response.claimedItems.length > 0) {
        successMsg += `Reivindicados: ${response.claimedItems.join(', ')}. `;
        console.log('DEBUG: Chamando showRecentClaims com:', response.claimedItems); // LOG PARA DEBUG
        showRecentClaims(response.claimedItems); // MOSTRA NA SEÇÃO
      } else {
        console.log('DEBUG: claimedItems vazio ou undefined:', response.claimedItems); // LOG PARA DEBUG
      }
      if (response.alreadyClaimed && response.alreadyClaimed.length > 0) {
        successMsg += `Itens já tomados: ${response.alreadyClaimed.join(', ')}.`;
      }
      alert(successMsg + ' 🎉');
      
      form.reset();
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

// NÃO carrega nada inicialmente – seção começa vazia