
window.openImmersiveViewer = function(type, url, title='Contenu'){
  const overlay = document.createElement('div');
  overlay.className = 'immersive-overlay';
  let content = '';

  if(type === 'pdf'){
    content = `<iframe src="${url}" class="immersive-frame"></iframe>`;
  } else if(type === 'audio'){
    content = `<audio controls class="immersive-audio" src="${url}"></audio>`;
  } else if(type === 'video'){
    content = `<iframe src="${url}" class="immersive-frame" allowfullscreen></iframe>`;
  } else {
    content = `<div class="immersive-text">Contenu interactif</div>`;
  }

  overlay.innerHTML = `
    <div class="immersive-sheet">
      <div class="immersive-handle"></div>
      <div class="immersive-head">
        <h2>${title}</h2>
        <button onclick="this.closest('.immersive-overlay').remove()">✕</button>
      </div>
      ${content}
      <button class="validate-btn">Valider aujourd'hui</button>
    </div>
  `;

  document.body.appendChild(overlay);
}
