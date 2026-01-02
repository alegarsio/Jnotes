const consoleBox = document.getElementById('console');
const filenameInput = document.getElementById('filename-input');
const sidebar = document.getElementById('sidebar');
const terminal = document.getElementById('console-container');
const saveStatus = document.getElementById('save-status');
const modal = document.getElementById('custom-modal');
const modalInput = document.getElementById('modal-input');
const modalTitle = document.getElementById('modal-title');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const resizer = document.getElementById('resizer-v');
const leftSide = document.getElementById('editor-container');
const workspace = document.getElementById('workspace');

let isResizing = false;

let myChart = null;
let autosaveTimer;
let currentRawData = [];
let openFiles = { top: [], bottom: [] };
let activeFile = { top: null, bottom: null };
let currentActiveFile = null;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('DOMContentLoaded', () => {
    mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'dark', 
        securityLevel: 'loose' 
    });
});

document.addEventListener('mousemove', (e) => {
    if (typeof isResizing === 'undefined' || !isResizing) return;
    
    const workspace = document.getElementById('workspace');
    const leftSide = document.getElementById('editor-container');
    const rect = workspace.getBoundingClientRect();
    
    let newWidth = ((e.clientX - rect.left) / rect.width) * 100;

    if (newWidth > 15 && newWidth < 85) {
        leftSide.style.width = `${newWidth}%`;
        localStorage.setItem('editor_width', `${newWidth}%`);
        
        if (typeof myChart !== 'undefined' && myChart) {
            myChart.resize();
        }
    }
});
document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        if (myChart) myChart.resize();
    }
});


function loadLayoutSettings() {
    const isSidebarClosed = localStorage.getItem('sidebar_closed') === 'true';
    const isConsoleClosed = localStorage.getItem('console_closed') === 'true';
    const lastEditorWidth = localStorage.getItem('editor_width');

    const sidebar = document.getElementById('sidebar');
    const consoleContainer = document.getElementById('console-container');
    const editorSide = document.getElementById('editor-container');

    if (isSidebarClosed && sidebar) sidebar.classList.add('closed');
    if (isConsoleClosed && consoleContainer) consoleContainer.classList.add('closed');
    
    if (lastEditorWidth && editorSide) {
        editorSide.style.width = lastEditorWidth;
    }

    setTimeout(() => {
        if (typeof myChart !== 'undefined' && myChart) {
            myChart.resize();
        }
    }, 100);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}
function toggleDiagramPanel() {
    DiagramManager.togglePanel();
}
function showGithubModal() {
    document.getElementById('github-modal').style.display = 'flex';
    document.getElementById('gh-repo').value = localStorage.getItem('gh_repo') || '';
    document.getElementById('gh-token').value = localStorage.getItem('gh_token') || '';
}

function closeGithubModal() {
    document.getElementById('github-modal').style.display = 'none';
}
async function syncWithGithub() {
    const repo = document.getElementById('gh-repo').value;
    const token = document.getElementById('gh-token').value;
    const content = document.getElementById('code-editor-top').value;
    const filename = activeFile.top;

    if (!repo || !token || !filename) {
        alert("Missing information: Repository, Token, or Active File.");
        return;
    }

    const btn = document.getElementById('gh-push-btn');
    btn.innerText = "Syncing...";
    btn.disabled = true;

    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
            headers: { 'Authorization': `token ${token}` }
        });

        let sha = null;
        if (res.ok) {
            const data = await res.json();
            sha = data.sha;
        }

        const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Sync ${filename} via JNote`,
                content: btoa(unescape(encodeURIComponent(content))),
                sha: sha
            })
        });

        if (putRes.ok) {
            consoleBox.innerHTML = `<span style="color:#58a6ff">[GitHub] Successfully synced ${filename} to ${repo}</span>`;
            closeGithubModal();
        } else {
            const err = await putRes.json();
            consoleBox.innerText = `[GitHub Error] ${err.message}`;
        }
    } catch (e) {
        consoleBox.innerText = "[GitHub Error] Connection failed.";
    } finally {
        btn.innerText = "Push to GitHub";
        btn.disabled = false;
    }
}
function showModal(title, defaultValue, onConfirm, isDelete = false) {
    modal.style.display = 'flex';
    modalTitle.innerText = title;
    modalInput.value = defaultValue;
    modalInput.style.display = isDelete ? 'none' : 'block';
    
    modalConfirmBtn.onclick = () => {
        onConfirm(modalInput.value);
        closeModal();
    };
    
    if (!isDelete) {
        setTimeout(() => modalInput.focus(), 100);
        modalInput.onkeydown = (e) => { if (e.key === 'Enter') modalConfirmBtn.click(); };
    }
}

function updateQuickStats(data) {
    const flatData = data.flat().filter(n => typeof n === 'number');
    
    if (flatData.length === 0) return;

    const sum = flatData.reduce((a, b) => a + b, 0);
    const avg = sum / flatData.length;
    const max = Math.max(...flatData);
    const min = Math.min(...flatData);

    document.getElementById('stat-avg').innerText = avg.toFixed(2);
    document.getElementById('stat-max').innerText = max.toFixed(2);
    document.getElementById('stat-min').innerText = min.toFixed(2);
    document.getElementById('stat-sum').innerText = sum.toFixed(2);
}

function closeModal() {
    modal.style.display = 'none';
}

function deleteFilePrompt() {
    if (!currentActiveFile) return;
    showModal(`Delete '${currentActiveFile}'?`, "", () => {
        executeDelete();
    }, true);
}

async function executeDelete() {
    const res = await fetch('/delete_file', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ filename: currentActiveFile })
    });
    if (res.ok) {
        openFiles.top = openFiles.top.filter(f => f !== currentActiveFile);
        activeFile.top = openFiles.top[0] || null;
        if (!activeFile.top) document.getElementById('code-editor-top').value = '';
        currentActiveFile = null;
        document.getElementById('file-ops').style.display = 'none';
        renderTabs('top');
        refreshFileList();
    }
}

function renameFilePrompt() {
    if (!currentActiveFile) return;
    const baseName = currentActiveFile.replace('.jackal', '');
    showModal("Rename File", baseName, (newName) => {
        executeRename(newName);
    });
}

async function executeRename(newName) {
    if (!newName) return;
    const res = await fetch('/rename_file', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ old_name: currentActiveFile, new_name: newName })
    });
    if (res.ok) {
        refreshFileList();
    }
}
async function initApp() {
    await refreshFileList();
    const lastFile = localStorage.getItem('lastOpenedFile');
    if (lastFile) {
        await loadFileToPane(lastFile, 'top');
    }
}
async function refreshFileList() {
    const res = await fetch('/list_files');
    if (!res.ok) return;
    const files = await res.json();
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    
    files.forEach(file => {
        const li = document.createElement('li');
        
        const isCsv = file.endsWith('.csv');
        const iconClass = isCsv ? 'fa-table-cells' : 'fa-code';
        const iconColor = isCsv ? '#28a745' : '#0071e3';

        li.innerHTML = `
            <i class="fa-solid ${iconClass}" style="color: ${iconColor}; font-size: 14px; width: 18px;"></i> 
            <span>${file}</span>
        `;
        
        li.onclick = () => {
            currentActiveFile = file;
            loadFileToPane(file, 'top');
        };
        
        list.appendChild(li);
    });
}
async function loadFileToPane(filename, pane) {
    const res = await fetch(`/load_file/${filename}`);
    if (!res.ok) return;
    const data = await res.json();
    
    if (!openFiles[pane].includes(filename)) {
        openFiles[pane].push(filename);
    }
    
    activeFile[pane] = filename;
    currentActiveFile = filename;
    
    const editorElem = document.getElementById(`code-editor-${pane}`);
    if (editorElem) {
        editorElem.value = data.content;
        filenameInput.value = filename;
        localStorage.setItem('lastOpenedFile', filename);
        renderTabs(pane);
        updateLineNumbers(pane);

        if (filename.endsWith('.csv')) {
            parseCSVToTable(data.content);
        }
    }
}

function parseCSVToTable(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const data = lines.map(line => {
        const values = line.split(',');
        return values.map(v => isNaN(v) ? v : parseFloat(v));
    });
    renderTable(data); 
}
function renderTabs(pane) {

    if (pane !== 'top') return;

    const tabBar = document.getElementById(`tab-bar-top`);
    if (!tabBar) return;
    
    tabBar.innerHTML = '';
    openFiles['top'].forEach(file => {
        const tab = document.createElement('div');
        tab.className = `tab ${activeFile['top'] === file ? 'active' : ''}`;
        tab.innerHTML = `
            <span onclick="switchTab('${file}', 'top')">${file}</span>
            <span class="btn-close-tab" onclick="closeTab(event, '${file}', 'top')">×</span>
        `;
        tabBar.appendChild(tab);
    });
}
function enableAutoIndent(editorId) {
    const textarea = document.getElementById(editorId);
    if (!textarea) return;

    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 4;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const start = this.selectionStart;
            const text = this.value;
            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
            const currentLine = text.substring(lineStart, start);
            const indentMatch = currentLine.match(/^\s*/);
            const indent = indentMatch ? indentMatch[0] : "";
            
            const before = text.substring(0, start);
            const after = text.substring(start);
            
            this.value = before + "\n" + indent + after;
            this.selectionStart = this.selectionEnd = start + indent.length + 1;
        }
    });
}

function closeTab(event, filename, pane) {
    event.stopPropagation();
    
    openFiles[pane] = openFiles[pane].filter(f => f !== filename);
    
    if (activeFile[pane] === filename) {
        activeFile[pane] = openFiles[pane][0] || null;
        const editorElem = document.getElementById(`code-editor-${pane}`);
        
        if (activeFile[pane]) {
            loadFileToPane(activeFile[pane], pane);
        } else {
            if (editorElem) {
                editorElem.value = '';
                updateLineNumbers(pane);
            }
        }
    }
    
    renderTabs(pane);
}

function switchTab(filename, pane) {
    loadFileToPane(filename, pane);
}

function closeTab(event, filename, pane) {
    event.stopPropagation();
    
    openFiles[pane] = openFiles[pane].filter(f => f !== filename);
    
    if (activeFile[pane] === filename) {
        activeFile[pane] = openFiles[pane][0] || null;
        const editorElem = document.getElementById(`code-editor-${pane}`);
        
        if (activeFile[pane]) {
            loadFileToPane(activeFile[pane], pane);
        } else {
            if (editorElem) {
                editorElem.value = '';
                updateLineNumbers(pane);
            }
        }
    }
    
    renderTabs(pane);
}
function updateLineNumbers(pane) {
    const editor = document.getElementById(`code-editor-${pane}`);
    const lineBox = document.getElementById(`line-numbers-${pane}`);
    if (!editor || !lineBox) return;
    const lines = editor.value.split('\n').length;
    let numStr = '';
    for (let i = 1; i <= lines; i++) numStr += i + '<br>';
    lineBox.innerHTML = numStr;
}

function syncScroll(pane) {
    const editor = document.getElementById(`code-editor-${pane}`);
    const lines = document.getElementById(`line-numbers-${pane}`);
    if (editor && lines) lines.scrollTop = editor.scrollTop;
}

function handleInput(pane) {
    updateLineNumbers(pane);
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
        saveFile(true, pane);
    }, 1500);
}
async function saveFile(isAutosave = false, pane = 'top') {
    const editorElem = document.getElementById(`code-editor-${pane}`);
    let filename = activeFile[pane] || filenameInput.value;

    if (!editorElem || !filename) return;

    if (saveStatus) saveStatus.innerText = "Saving...";

    try {
        const res = await fetch('/save_file', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ filename, content: editorElem.value }) 
        });

        if (res.ok) {
            localStorage.setItem('lastOpenedFile', filename);
            if (saveStatus) saveStatus.innerText = "All changes saved";
            if (!isAutosave) {
                consoleBox.innerText = `[System] Saved ${filename}`;
                refreshFileList(); 
            }
        }
    } catch (e) {
        if (saveStatus) saveStatus.innerText = "Save failed";
    }
}

async function runCode() {
    const code = document.getElementById('code-editor-top').value;
    const consoleBox = document.getElementById('console');
    
    if (consoleBox) consoleBox.innerText = "Executing Jackal code...";

    try {
        const res = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });

        const data = await res.json();
        
        if (consoleBox) {
            consoleBox.innerText = data.output;
        }

        const match = data.output.match(/\[\[.*\]\]|\[.*\]/s);
        
        if (match) {
            const parsedData = JSON.parse(match[0]);
            
            window.lastExecutionData = parsedData; 
            
            if (typeof renderChart === 'function') renderChart(parsedData);
            if (typeof renderTable === 'function') renderTable(parsedData);
            
            const diagramPanel = document.getElementById('diagram-panel');
            if (diagramPanel && !diagramPanel.classList.contains('closed')) {
                if (typeof DiagramManager !== 'undefined') {
                    DiagramManager.generate();
                }
            }
        }
    } catch (e) {
        if (consoleBox) consoleBox.innerText = "Error: Failed to connect to server.";
    }
}

async function deleteFilePrompt() {
    if (!currentActiveFile) return;
    if (confirm(`Apakah Anda yakin ingin menghapus ${currentActiveFile}?`)) {
        const res = await fetch('/delete_file', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ filename: currentActiveFile })
        });
        if (res.ok) {
            openFiles.top = openFiles.top.filter(f => f !== currentActiveFile);
            openFiles.bottom = openFiles.bottom.filter(f => f !== currentActiveFile);
            currentActiveFile = null;
            newFile(); 
            refreshFileList();
            renderTabs('top');
            renderTabs('bottom');
        }
    }
}

async function renameFilePrompt() {
    if (!currentActiveFile) return;
    const newName = prompt("Masukkan nama baru:", currentActiveFile);
    if (newName && newName !== currentActiveFile) {
        const res = await fetch('/rename_file', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ old_name: currentActiveFile, new_name: newName })
        });
        if (res.ok) {
            refreshFileList();
        }
    }
}
function renderTable(chartData) {
    const wrapper = document.getElementById('dynamic-table-wrapper');
    currentRawData = chartData;

    if (!Array.isArray(chartData) || chartData.length === 0) {
        wrapper.innerHTML = '<p class="empty-msg">No data processed</p>';
        updateQuickStats([]);
        return;
    }

    updateQuickStats(chartData);

    let tableHTML = '<table><thead><tr><th>Index</th>';
    const isMulti = Array.isArray(chartData[0]);

    if (isMulti) {
        chartData.forEach((_, i) => tableHTML += `<th>Series ${i + 1}</th>`);
    } else {
        tableHTML += '<th>Value</th>';
    }
    tableHTML += '</tr></thead><tbody>';

    const rowCount = isMulti ? chartData[0].length : chartData.length;
    for (let r = 0; r < rowCount; r++) {
        tableHTML += `<tr><td># ${r}</td>`;
        if (isMulti) {
            chartData.forEach(series => {
                const val = series[r] !== undefined ? series[r] : '-';
                tableHTML += `<td>${val}</td>`;
            });
        } else {
            tableHTML += `<td><b>${chartData[r]}</b></td>`;
        }
        tableHTML += '</tr>';
    }
    tableHTML += '</tbody></table>';
    wrapper.innerHTML = tableHTML;
}

function exportToCSV() {
    if (currentRawData.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,Index,Value\n";
    currentRawData.forEach((val, idx) => { csvContent += `${idx},${val}\n`; });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "data.csv");
    document.body.appendChild(link);
    link.click();
}
function renderChart(chartData) {
    const chartDom = document.getElementById('jackalChart');
    if (!myChart) myChart = echarts.init(chartDom);
    
    const type = document.getElementById('chart-type').value;
    const colors = ['#0071e3', '#34c759', '#af52de', '#ff9500', '#ff2d55', '#5ac8fa'];
    
    const parseNestedData = (data) => {
        if (!Array.isArray(data)) return parseFloat(data) || 0;
        return data.map(item => parseNestedData(item));
    };

    const processedData = parseNestedData(chartData);
    let series = [];
    let xAxisData = [];
    const isMultiSeries = Array.isArray(processedData) && Array.isArray(processedData[0]);

    if (type === 'pie') {
        const flatPieData = isMultiSeries ? processedData[0] : processedData;
        series.push({
            type: 'pie',
            radius: ['45%', '70%'],
            itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: '16', fontWeight: 'bold' } },
            data: flatPieData.map((val, i) => ({ value: val, name: `Data ${i}` }))
        });
    } else if (type === 'scatter') {
        const scatterData = (isMultiSeries && processedData.length >= 2) 
            ? processedData[0].map((val, i) => [val, processedData[1][i] || 0])
            : processedData.flat(Infinity).map((val, i) => [i, val]);
        
        series.push({
            type: 'scatter',
            symbolSize: 15,
            data: scatterData,
            itemStyle: {
                color: colors[0],
                shadowBlur: 10,
                shadowColor: 'rgba(0, 113, 227, 0.3)',
                opacity: 0.8
            }
        });
    } else {
        const seriesSet = isMultiSeries ? processedData : [processedData.flat(Infinity)];
        seriesSet.forEach((data, i) => {
            series.push({
                name: `Series ${i + 1}`,
                type: type === 'area' ? 'line' : type,
                data: data,
                smooth: true,
                showSymbol: false,
                areaStyle: type === 'area' ? {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: colors[i % colors.length] + '66' },
                        { offset: 1, color: colors[i % colors.length] + '00' }
                    ])
                } : null,
                itemStyle: { color: colors[i % colors.length] },
                emphasis: { focus: 'series', lineStyle: { width: 3 } }
            });
            if (data.length > xAxisData.length) xAxisData = Array.from({length: data.length}, (_, k) => k);
        });
    }

    const option = {
        animationDuration: 1200,
        backgroundColor: 'transparent',
        tooltip: { 
            trigger: (type === 'pie' || type === 'scatter') ? 'item' : 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderWidth: 0,
            shadowBlur: 20,
            shadowColor: 'rgba(0,0,0,0.1)',
            textStyle: { color: '#1d1d1f', fontSize: 12 },
            axisPointer: { type: 'cross', label: { backgroundColor: '#0071e3' } }
        },
        toolbox: {
            show: true,
            right: 25,
            top: 10,
            feature: {
                dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom Area', back: 'Reset' } },
                dataView: { readOnly: false, title: 'View Data' },
                magicType: { type: ['line', 'bar'], title: { line: 'To Line', bar: 'To Bar' } },
                restore: { title: 'Restore' },
                saveAsImage: { title: 'Export PNG', pixelRatio: 2 }
            }
        },
        dataZoom: type === 'pie' ? [] : [
            { type: 'inside', start: 0, end: 100 },
            { 
                type: 'slider', 
                bottom: 15, 
                height: 20,
                handleIcon: 'path://M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
                handleSize: '80%',
                handleStyle: { color: '#fff', shadowBlur: 3, shadowColor: 'rgba(0, 0, 0, 0.6)', shadowOffsetX: 2, shadowOffsetY: 2 }
            }
        ],
        grid: { top: '18%', left: '5%', right: '8%', bottom: '15%', containLabel: true },
        xAxis: type === 'pie' ? { show: false } : { 
            type: type === 'scatter' ? 'value' : 'category', 
            data: type === 'scatter' ? null : xAxisData,
            axisLine: { lineStyle: { color: '#d2d2d7' } },
            splitLine: { show: false }
        },
        yAxis: type === 'pie' ? { show: false } : { 
            type: 'value', 
            scale: true,
            splitLine: { lineStyle: { type: 'dashed', color: '#f5f5f7' } }
        },
        legend: { show: series.length > 1 || type === 'pie', top: 15, left: 'center', textStyle: { color: '#86868b' } },
        series: series
    };

    myChart.setOption(option, true);
}
function newFile() { 
    const fileName = prompt("Masukkan nama file (contoh: data.csv atau script.jackal):");
    if (!fileName) return;

    let finalName = fileName.trim();
    if (!finalName.includes('.')) {
        finalName += '.jackal';
    }

    activeFile['top'] = finalName;
    currentActiveFile = finalName;
    filenameInput.value = finalName;
    
    const editorElem = document.getElementById('code-editor-top');
    if (editorElem) editorElem.value = '';

    if (!openFiles['top'].includes(finalName)) {
        openFiles['top'].push(finalName);
    }

    renderTabs('top');
    saveFile(false, 'top');
    showToast(`File "${finalName}" berhasil dibuat`, "success");
}
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('closed');
    localStorage.setItem('sidebar_closed', sidebar.classList.contains('closed'));
}
function toggleTerminal() {
    const consoleContainer = document.getElementById('console-container');
    if (!consoleContainer) return;

    consoleContainer.classList.toggle('closed');
    localStorage.setItem('console_closed', consoleContainer.classList.contains('closed'));

    if (typeof myChart !== 'undefined') {
        setTimeout(() => myChart.resize(), 300);
 
    }
}

function toggleAIChat() {
    const sidebar = document.getElementById('ai-chat-sidebar');
    sidebar.classList.toggle('closed');
}

async function sendToGemini() {
    const inputField = document.getElementById('ai-user-input');
    const container = document.getElementById('ai-chat-messages');
    const prompt = inputField.value.trim();
    
    const codeContext = document.getElementById('code-editor-top').value;
    const currentFile = activeFile['top'] || 'untitled.jackal';

    if (!prompt) return;

    appendMessage('user', prompt);
    inputField.value = '';
    inputField.style.height = 'auto';
    
    const loadingId = 'loading-' + Date.now();
    const loadingDiv = appendMessage('bot', 'Gemini is analyzing your file...', loadingId);

    try {
        const res = await fetch('/ask_ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: prompt, 
                context: codeContext,
                filename: currentFile 
            })
        });

        const data = await res.json();
        loadingDiv.innerText = data.suggestion;
    } catch (e) {
        loadingDiv.innerText = "Error: Failed to connect to Gemini.";
        loadingDiv.classList.add('error');
    }
}

function appendMessage(sender, text) {
    const container = document.getElementById('ai-chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-msg ${sender}`;
    msgDiv.innerText = text;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return msgDiv;
}

initApp();

window.addEventListener('resize', () => {
    if (typeof myChart !== 'undefined' && myChart) {
        myChart.resize();
    }
});
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile(false, 'top');
    }
});

document.getElementById('ai-user-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendToGemini();
    }
});
window.addEventListener('DOMContentLoaded', () => {
    loadLayoutSettings();
    enableAutoIndent('code-editor-top');
});
window.addEventListener('DOMContentLoaded', loadLayoutSettings);