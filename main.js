/* ---------- LIFF 初期化 ---------- */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.liff) {
        console.error('LIFF SDK not loaded');
        return;
    }

    liff.ready.then(() => {
        liff.init({
            liffId: '2007738867-wPJ2rxV0',
            withLoginOnExternalBrowser: true,
        }).then(() => {
            console.log('LIFF init success');
        }).catch(console.error);
    });
});

/* ---------- アプリ本体 ---------- */
const canvasSize = 320;
const STORAGE_KEY = 'rouletteHistory';

/* ---------- HTMLエスケープ ---------- */
function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c] || c));
}

/* ---------- URL パラメータ復元 ---------- */
const qs = new URLSearchParams(location.search);
const raw = qs.get('d');
let items = [];
if (raw) {
    try {
        // LZString のロード遅延やデコード失敗に備えてフォールバック
        const decodedStr = (typeof LZString !== 'undefined' &&
            (LZString.decompressFromEncodedURIComponent(raw) ||
             LZString.decompress(raw))) || '';
        if (decodedStr) items = JSON.parse(decodedStr).map(sanitize).slice(0, 10);
    } catch (e) {
        console.warn('Failed to decode params', e);
    }
}

/* ---------- DOM キャッシュ ---------- */
const app = document.getElementById('app');
const homeBtn = document.getElementById('homeBtn');
const templates = {
    form: document.getElementById('form-template'),
    roulette: document.getElementById('roulette-template'),
    result: document.getElementById('result-template'),
    history: document.getElementById('history-template'),
};

/* ---------- ヘッダー操作 ---------- */
homeBtn.addEventListener('click', () => {
    items = [];
    history.replaceState(null, '', location.pathname);
    renderForm();
});

/* ---------- ルーレット描画 ---------- */
function drawWheel(rotation) {
    const canvas = document.getElementById('wheel');
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.translate(canvasSize / 2, canvasSize / 2);
    ctx.rotate(rotation);
    const angle = (2 * Math.PI) / items.length;
    for (let i = 0; i < items.length; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, canvasSize / 2, i * angle, (i + 1) * angle);
        ctx.closePath();
        ctx.fillStyle = `hsl(${(i * 360) / items.length},70%,70%)`;
        ctx.fill();
        ctx.save();
        ctx.rotate(i * angle + angle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 16px "Noto Sans JP", sans-serif';
        ctx.fillText(items[i], canvasSize / 2 - 14, 0);
        ctx.restore();
    }
    ctx.restore();
}

let angVel = 0, ang = 0, spinning = false;
function startSpin() {
    if (spinning) return;
    spinning = true;
    angVel = Math.random() * 0.28 + 0.32;
    requestAnimationFrame(frame);
}
function frame() {
    if (!spinning) return;
    ang += angVel;
    ang %= 2 * Math.PI;
    angVel *= 0.984;
    drawWheel(ang);
    if (angVel < 0.002) {
        spinning = false;
        const winnerIndex = items.length - Math.floor(((ang % (2 * Math.PI)) / (2 * Math.PI)) * items.length) - 1;
        saveHistory(items, items[winnerIndex]);
        renderResult(items[winnerIndex]);
    } else {
        requestAnimationFrame(frame);
    }
}

/* ---------- History ---------- */
function getHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
}
function saveHistory(allItems, winner) {
    const hist = getHistory();
    hist.unshift({ ts: Date.now(), winner, all: [...allItems] });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hist.slice(0, 50)));
}
function renderHistoryList(ul) {
    ul.innerHTML = '';
    const hist = getHistory();
    if (hist.length === 0) {
        ul.innerHTML = '<li>履歴はまだありません。</li>';
        return;
    }
    hist.forEach(h => {
        const li = document.createElement('li');
        const date = new Date(h.ts || h.timestamp).toLocaleString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        const allNames = (h.all || h.items || []).map(escapeHtml).join(', ');
        li.innerHTML = `<strong>${date} ▶︎ ${escapeHtml(h.winner)}</strong><br><small>${allNames}</small>`;
        ul.appendChild(li);
    });
}

/* ---------- 画面レンダリング ---------- */
function renderForm() {
    app.innerHTML = '';
    const node = templates.form.content.cloneNode(true);
    app.appendChild(node);

    const inputsArea = document.getElementById('itemInputs');
    const addItemBtn = document.getElementById('addItem');
    const formEl = document.getElementById('itemForm');
    const errorBox = document.getElementById('errorBox');

    const initCount = Math.max(3, items.length || 0);
    for (let i = 0; i < initCount; i++) addInput(i);

    inputsArea.querySelectorAll('input').forEach((inp, idx) => {
        inp.value = items[idx] || '';
    });

    addItemBtn.addEventListener('click', () => addInput(inputsArea.children.length));

    formEl.onsubmit = e => {
        e.preventDefault();
        const arr = [...inputsArea.querySelectorAll('input')].map(i => sanitize(i.value));
        const valid = arr.filter(Boolean);
        if (valid.length < 2) {
            errorBox.textContent = '2名以上入力してください。';
            errorBox.style.display = 'block';
            return;
        }
        errorBox.style.display = 'none';
        items = valid.slice(0, 10);
        const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(items));
        history.replaceState(null, '', `${location.pathname}?d=${encoded}`);
        renderRoulette();
    };

    const homeHistSection = document.getElementById('homeHistorySection');
    const homeHistList = document.getElementById('homeHistoryList');
    renderHistoryList(homeHistList);
    if (homeHistList.childElementCount) homeHistSection.style.display = 'block';

    function addInput(idx) {
        if (inputsArea.children.length >= 10) return;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = `メンバー${idx + 1}`;
        inputsArea.appendChild(inp);
    }
}

function renderRoulette() {
    app.innerHTML = '';
    const node = templates.roulette.content.cloneNode(true);
    app.appendChild(node);
    drawWheel(0);
    document.getElementById('spinBtn').addEventListener('click', startSpin);
}

function renderResult(winner) {
    app.innerHTML = '';
    const node = templates.result.content.cloneNode(true);
    app.appendChild(node);
    document.getElementById('winnerText').textContent = `${winner} さんに決定！`;
    document.getElementById('retryBtn').addEventListener('click', () => renderRoulette());
}

function renderHistory() {
    app.innerHTML = '';
    const node = templates.history.content.cloneNode(true);
    app.appendChild(node);
    const ul = document.getElementById('historyList');
    renderHistoryList(ul);
    document.getElementById('backBtn').addEventListener('click', () => renderForm());
}

/* ---------- Util ---------- */
function sanitize(str) {
    return (str || '').trim().replace(/[<>"']/g, '');
}

/* ---------- 初期ロード ---------- */
if (items.length >= 2) {
    renderRoulette();
} else {
    renderForm();
}