// Initialize Firebase and enforce Google authentication before showing the app
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfigFromHost = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
const firebaseConfig = firebaseConfigFromHost ? JSON.parse(firebaseConfigFromHost) : {
    apiKey: "AIzaSyCsDIUOYmxLhvw_uL-lvYFu89AtfIfwhH0",
    authDomain: "doichecker.firebaseapp.com",
    projectId: "doichecker",
    storageBucket: "doichecker.firebasestorage.app",
    messagingSenderId: "798815713057",
    appId: "1:798815713057:web:ffb823337b7acbfba27060",
    measurementId: "G-8N4P8YW0WK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

function showApp() {
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('login-screen').classList.add('hidden');
}

function showLogin() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    showApp();
  } else {
    showLogin();
  }
});

export function login() {
  signInWithPopup(auth, provider).catch((err) => console.error(err));
}

// expose login globally for inline onclick handler
window.login = login;
//forbidding eval for security
window.eval = () => {
  throw new Error('eval() is disabled for security');
};

/**
 * 1. Escape any HTML special chars so user input never renders as markup.
 */
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 2. Enforce a whitelist of allowed characters via regex.
 *    (Adjust the pattern to suit your use-case.)
 */
function validatePattern(input, pattern = /^[a-zA-Z0-9\s.,!?-]*$/) {
  return pattern.test(input);
}

/**
 * 3. Enforce sensible length limits.
 */
function validateLength(input, { min = 1, max = 500 } = {}) {
  return typeof input === 'string'
      && input.length >= min
      && input.length <= max;
}

// --- Load journal ranks ---
let journalRanks = [];
Papa.parse('data/ranks.csv', {
  download: true,
  header: true,
  skipEmptyLines: true,
  transformHeader: h => h.trim(),
  complete: ({ data }) => {
    journalRanks = data
      .filter(r => (r.title || r.journal) && r.rank)
      .map(r => ({
        title: (r.title || r.journal).trim(),
        rank: Number(r.rank),
        wordCount: (r.title || r.journal).trim().split(/\s+/).length
      }))
      .sort((a, b) => b.wordCount - a.wordCount);
    document.getElementById('validate-btn').disabled = false;
  },
  error: err => {
    console.error('Failed to load journal ranks:', err);
    document.getElementById('validate-btn').disabled = false;
  }
});

// --- Constants & Regex ---
const mailto        = 'your-email@example.com';
const doiRegex      = /\b10\.\d{4,9}\/[\-._;()\/:A-Za-z0-9]+\b/;
const newlineHyphen = /(\d)-(?:\r?\n|\s)+(?=\d)/g;
// split before each new reference beginning with uppercase author and year
const refSplitRe = /\r?\n(?=[A-Z].*?\(\d{4}[a-z]?\)[\.,]?)/g;
const escapeRe      = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//const validationRe = /^[a-zA-Z0-9\s.,!?-\(\)\/]*$/g;

document.getElementById('bib-text')
  .addEventListener('input', function() {
    this.classList.toggle('text-xs', this.value.trim() !== '');
  });

document.getElementById('validate-btn')
  .addEventListener('click', handleValidate);

async function handleValidate() {
  const raw = document.getElementById('bib-text').value;
  //performing some input checks
  // 1) Length & pattern checks
    if (!validateLength(raw, {min:1, max:2000})) {
      alert('Input must be between 1 and 2000 characters.');
      return;
    }
    //if (!validatePattern(raw,patter=validationRe)) {
      //alert('Invalid characters detected.');
      //return;
    //}
  
  const tableBody = document.getElementById('analysis-table');
  const tableWrap = document.getElementById('table-container');
  tableBody.innerHTML = '';
  tableWrap.classList.add('hidden');

  if (!raw.trim()) {
    alert('Please paste bibliography text before validating.');
    return;
  }

  // 1) Split into individual references
  const refBlocks = raw
    .replace(newlineHyphen, '$1-')
    .split(refSplitRe)
    .filter(b => b.trim());

  // 2) Build per-block analysis entries
  const analysis = refBlocks.map(block => {
    // DOI detection (first match)
    const doiMatch = block.match(doiRegex);
    const doi = doiMatch
      ? doiMatch[0].replace(/[.,;:]+$/, '')
      : null;

    // Journal detection with punctuation boundaries
    let journalTitle = '', journalRank = '';
    for (const { title, rank } of journalRanks) {
      const pat = `(?<=[,\.\\;\\:\\!\\?0-9]\\s)${escapeRe(title)}(?=[,\.\\;\\:\\!\\?0-9])`;
      const re = new RegExp(pat, 'i');
      if (re.test(block)) {
        journalTitle = title;
        journalRank  = rank;
        break;
      }
    }

    return { block: block.trim(), doi, journalTitle, journalRank, status: null };
  });

// 3) Check each DOI in parallel against Crossref
    await Promise.all(analysis.map(item => {
      if (!item.doi) {
        item.status = '';
        return Promise.resolve();
      }
      return fetch(
        `https://api.crossref.org/works/${encodeURIComponent(item.doi)}?mailto=${encodeURIComponent(mailto)}`
      )
      .then(r => {
        item.status = (r.status === 200) ? '✔️' : '❌';
      })
      .catch(() => {
        item.status = '❌';
      });
    }));

  // 4) Render table rows
  analysis.forEach(({ block, doi, status, journalTitle, journalRank }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-2 py-1 align-top">${block}</td>
      <td class="border px-2 py-1 text-center">
        ${doi
          ? `<a href="https://doi.org/${encodeURIComponent(doi)}" target="_blank" class="text-blue-600 hover:underline">${doi}</a>`
          : ''
        }
      </td>
      <td class="border px-2 py-1 text-center">${status || ''}</td>
      <td class="border px-2 py-1">${journalTitle}</td>
      <td class="border px-2 py-1 text-center">${journalRank || ''}</td>
    `;
    tableBody.appendChild(tr);
  });

  tableWrap.classList.remove('hidden');
}
