const form = document.getElementById('giftForm');
const resultsContainer = document.getElementById('resultsContainer');
const submitButton = form.querySelector('button[type="submit"]');

// Função para esconder itens já reivindicados no formulário
function hideClaimedItems(data) {
  const itemRows = document.querySelectorAll('.item-row');
  itemRows.forEach(row => {
    const input = row.querySelector('.input-name');
    if (input && data[input.name] && data[input.name].length > 0) {
      row.style.display = 'none'; // Esconde a linha inteira
      row.style.opacity = '0.5'; // Opcional: deixa semi-transparente se quiser mostrar como "indisponível"
    }
  });
  console.log('Itens reivindicados escondidos no formulário.');
}

// Função para atualizar a lista de nomes do servidor E esconder itens
async function fetchNames() {
  try {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #a85a7a;">Carregando lista de nomes...</p>';
    const res = await fetch('/api/names');
    if (!res.ok) {
      throw new Error('Erro na resposta do servidor');
    }
    const data = await res.json();
    resultsContainer.innerHTML = '';
    
    if (Object.keys(data).length === 0) {
      resultsContainer.innerHTML = '<p style="text-align: center; color: #a85a7a; font-style: italic;">Nenhum item reivindicado ainda. Seja o primeiro! 💕</p>';
      return data; // Retorna data vazia para não esconder nada
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
    
    // Esconde itens reivindicados no form
    hideClaimedItems(data);
    
    return data;
  } catch (err) {
    console.error('Erro ao buscar nomes:', err);
    resultsContainer.innerHTML = '<p style="text-align: center; color: #a85a7a;">Erro ao carregar nomes. Tente recarregar a página. 🔄</p>';
    return {};
  }
}

// Função para esconder itens específicos após envio
function hideSubmittedItems(entries) {
  for (const [item] of Object.entries(entries)) {
    const row = document.querySelector(`input[name="${item}"]`)?.closest('.item-row');
    if (row) {
      row.style.display = 'none';
    }
  }
}

// Função para enviar o formulário com feedback visual
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
  
  // Feedback visual: desabilita botão e mostra loading
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
    
    if (res.ok) {
      // Sucesso: mostra mensagem personalizada
      let successMsg = 'Itens reivindicados com sucesso! ';
      if (response.claimedItems && response.claimedItems.length > 0) {
        successMsg += `Reivindicados: ${response.claimedItems.join(', ')}. `;
      }
      if (response.alreadyClaimed && response.alreadyClaimed.length > 0) {
        successMsg += `Itens já tomados: ${response.alreadyClaimed.join(', ')}.`;
      }
      alert(successMsg + ' 🎉');
      
      form.reset(); // Limpa todos os campos
      hideSubmittedItems(entries); // Esconde os itens enviados
      fetchNames(); // Atualiza a lista e esconde outros se necessário
    } else {
      alert(`Erro ao reivindicar: ${response.error || 'Tente novamente.'} 😔`);
    }
  } catch (err) {
    console.error('Erro na conexão:', err);
    alert('Erro na conexão com o servidor. Verifique sua internet e tente novamente. 📡');
  } finally {
    // Restaura o botão
    submitButton.disabled = false;
    submitButton.textContent = 'Reivindicar';
    submitButton.style.backgroundColor = '#f8c8d8';
    submitButton.style.color = '#7a3e5a';
  }
}

// Adiciona o event listener ao form
form.addEventListener('submit', handleSubmit);

// Atualiza a lista ao carregar a página (e esconde itens tomados)
fetchNames();

// Atualiza a lista a cada 30 segundos para mostrar reivindicações novas
setInterval(fetchNames, 30000);