export function formatTitleCase(str) {
  if (typeof str !== 'string') return str;
  if (!str.trim()) return str;

  let newStr = str.replace(/\bsvg\b/ig, "").trim();

  newStr = newStr.split(/\s+/).map(word => {
    if (/[\d₹$%]/.test(word)) return word;
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
  
  return newStr;
}

export function initTextFormatter() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => processNode(node));
      } else if (mutation.type === 'characterData') {
        processTextNode(mutation.target);
      } else if (mutation.type === 'attributes') {
        processAttribute(mutation.target, mutation.attributeName);
      }
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'alt']
  });

  // Process existing nodes
  processNode(document.documentElement);

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      processTextNode(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) return;
      
      ['placeholder', 'title', 'alt'].forEach(attr => {
        if (node.hasAttribute(attr)) {
          processAttribute(node, attr);
        }
      });

      node.childNodes.forEach(processNode);
    }
  }

  function processTextNode(node) {
    const oldText = node.nodeValue;
    if (!oldText || !oldText.trim()) return;
    
    // Ignore if it's inside a script or style
    if (node.parentElement && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) return;

    const newText = formatTitleCase(oldText);
    if (oldText !== newText) {
      node.nodeValue = newText;
    }
  }

  function processAttribute(node, attr) {
    const oldText = node.getAttribute(attr);
    if (!oldText || !oldText.trim()) return;
    const newText = formatTitleCase(oldText);
    if (oldText !== newText) {
      node.setAttribute(attr, newText);
    }
  }
}
