// popup.js — Grouped VEX Block Extractor (no dictionary, auto section detection)

const frame = document.getElementById('frame');
frame.src = chrome.runtime.getURL('camera.html');

const extractBtn = document.getElementById('extract');
const statusEl = document.getElementById('status');
const outEl = document.getElementById('out');

extractBtn.addEventListener('click', async () => {
  statusEl.textContent = 'Extracting grouped VEX block commands...';
  outEl.innerHTML = '';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusEl.textContent = 'No active tab.';
    return;
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: () => {
      const out = { grouped: {}, notes: [] };

      try {
        const flyout =
          document.querySelector('.blocklyFlyout') ||
          document.querySelector('svg .blocklyFlyout') ||
          (document.querySelector('.blocklyFlyoutBackground, g[class*="Flyout"]')?.closest?.('g')) ||
          null;
        if (!flyout) {
          out.notes.push('No Blockly flyout found.');
          return out;
        }

        // Identify text elements that look like section titles (uppercase first letters, multiple words)
        const allTextNodes = Array.from(flyout.querySelectorAll('text'));
        const sectionTitles = [];

        allTextNodes.forEach((t) => {
          const txt = (t.textContent || '').trim();
          if (/^[A-Z][A-Za-z\s\-]+$/.test(txt) && txt.length > 3) {
            sectionTitles.push({ el: t, name: txt.replace(/\s+-\s+.*/, '').trim() });
          }
        });

        // Get all top-level draggable blocks
        const allBlocks = Array.from(flyout.querySelectorAll('g.blocklyDraggable'));

        // Assign blocks to nearest preceding section header
        let currentCategory = 'Uncategorized';
        const groups = {};

        for (const g of allBlocks) {
          // Find the closest preceding <text> section label above it
          const bbox = g.getBoundingClientRect();
          const titleAbove = sectionTitles
            .filter(s => s.el.getBoundingClientRect().y < bbox.y)
            .sort((a, b) => b.el.getBoundingClientRect().y - a.el.getBoundingClientRect().y)[0];
          if (titleAbove) currentCategory = titleAbove.name;

          const rawText = Array.from(g.querySelectorAll('text'))
            .map(t => (t.textContent || '').trim())
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .toLowerCase();

          if (!rawText || rawText.length < 2) continue;

          let cleaned = rawText
            .replace(/\b\d+(\.\d+)?\b/g, '') // remove numbers
            .replace(/\b(mm|cm|m|deg|degree|degrees|sec|secs|seconds|ms|%)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          // Skip placeholder examples
          if (cleaned.startsWith('apple') || cleaned.startsWith('banana')) continue;
          if (cleaned === 'text' || cleaned === 'black' || cleaned === 'thin') continue;

          if (!groups[currentCategory]) groups[currentCategory] = new Set();
          groups[currentCategory].add(cleaned);
        }

        // Convert sets to sorted arrays
        for (const k in groups) {
          out.grouped[k] = Array.from(groups[k]).sort((a, b) => a.localeCompare(b));
        }
      } catch (e) {
        out.notes.push('Error: ' + (e.message || e));
      }

      return out;
    }
  });

  const groups = result?.grouped || {};
  const categories = Object.keys(groups);
  if (!categories.length) {
    statusEl.textContent = 'No blocks found.';
    outEl.innerHTML = '<div>No VEX blocks detected.</div>';
    return;
  }

  statusEl.textContent = `Extracted ${categories.length} categories of VEX blocks.`;

  const htmlSections = categories
    .map(cat => `
      <div style="margin-top:10px;">
        <div style="font-weight:700; font-size:15px; margin-bottom:4px;">${cat}</div>
        <ul style="margin:0 0 0 16px; line-height:1.6;">
          ${groups[cat].map(cmd => `<li>${cmd}</li>`).join('')}
        </ul>
      </div>
    `)
    .join('');

  outEl.innerHTML = `
    <div style="margin:10px 0;">
      <div style="font-weight:700; font-size:16px;">VEX Block Commands</div>
      ${htmlSections}
    </div>
  `;
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'gaze-update') {
    // Forward to tracker.js if it's loaded
    if (window.updateGazeFromPage) {
      window.updateGazeFromPage(msg);
    }
  }
});
