const consoleBox = document.getElementById('console');
const filenameInput = document.getElementById('filename-input');
const sidebar = document.getElementById('sidebar');
const terminal = document.getElementById('console-container');
const saveStatus = document.getElementById('save-status');
const modal = document.getElementById('custom-modal');
const modalInput = document.getElementById('modal-input');
const modalTitle = document.getElementById('modal-title');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');


let myChart = null;
let autosaveTimer;
let currentRawData = [];
let openFiles = { top: [], bottom: [] };
let activeFile = { top: null, bottom: null };
let currentActiveFile = null;
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
        li.innerHTML = `<img src="/static/icon.png" class="file-icon"> <span>${file}</span>`;
        
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
    }
}
function renderTabs(pane) {
    // Hanya jalankan logika tab jika pane adalah 'top'
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
    const filename = activeFile[pane] || filenameInput.value || 'untitled.jackal';
    if (!editorElem) return;

    if (saveStatus) saveStatus.innerText = "Saving...";
    await fetch('/save_file', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ filename, content: editorElem.value }) 
    });
    
    localStorage.setItem('lastOpenedFile', filename);
    setTimeout(() => {
        if (saveStatus) saveStatus.innerText = "All changes saved";
    }, 500);

    if (!isAutosave) {
        consoleBox.innerText = `[System] Saved ${filename}`;
        refreshFileList();
    }
}

async function runCode() {
    const code = document.getElementById('code-editor-top').value;
    terminal.classList.remove('closed');
    consoleBox.innerText = "Executing...";
    
    const res = await fetch('/run', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ code: code }) 
    });
    
    const data = await res.json();
    consoleBox.innerText = data.output;
    const match = data.output.match(/\[\[.*\]\]|\[.*\]/s);
    if (match) {
        try {
            const parsedData = JSON.parse(match[0]);
            renderChart(parsedData);
            renderTable(parsedData);
        } catch(e) {
            consoleBox.innerText += "\n[Error] Data parsing failed.";
        }
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
        return;
    }
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
            chartData.forEach(series => tableHTML += `<td>${series[r] !== undefined ? series[r] : '-'}</td>`);
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
    const isMulti = Array.isArray(chartData) && Array.isArray(chartData[0]);
    
    let series = [];
    let xAxisData = [];
    const colors = ['#0071e3', '#34c759', '#af52de', '#ff9500', '#ff2d55'];

    if (isMulti) {
        chartData.forEach((data, i) => {
            series.push({
                name: `Series ${i + 1}`,
                type: (type === 'area' || type === 'line') ? 'line' : type,
                data: data,
                smooth: true,
                showSymbol: false,
                emphasis: { focus: 'series', lineStyle: { width: 4 } },
                itemStyle: { color: colors[i % colors.length] },
                areaStyle: type === 'area' ? {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: colors[i % colors.length] + '55' },
                        { offset: 1, color: colors[i % colors.length] + '00' }
                    ])
                } : null
            });
            if (data.length > xAxisData.length) xAxisData = Array.from({length: data.length}, (_, k) => k);
        });
    } else {
        series.push({
            name: 'Analysis Result',
            type: (type === 'area' || type === 'line') ? 'line' : type,
            data: chartData,
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#0071e3' },
            areaStyle: type === 'area' ? {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(0, 113, 227, 0.3)' },
                    { offset: 1, color: 'rgba(0, 113, 227, 0)' }
                ])
            } : null
        });
        xAxisData = chartData.map((_, i) => i);
    }

    const option = {
        animationDuration: 1000,
        backgroundColor: 'transparent',
        tooltip: { 
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderWidth: 0,
            shadowBlur: 15,
            shadowColor: 'rgba(0,0,0,0.1)',
            axisPointer: { type: 'cross', label: { backgroundColor: '#0071e3' } }
        },
        toolbox: {
            right: 20, 
            top: 0,
            feature: {
                dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom Area', back: 'Reset Zoom' } },
                magicType: { type: ['line', 'bar'], title: { line: 'Line', bar: 'Bar' } },
                restore: { title: 'Restore' },
                saveAsImage: { title: 'Export PNG' }
            }
        },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { 
                type: 'slider', 
                start: 0, 
                end: 100, 
                bottom: 10, 
                height: 20,
                borderColor: 'transparent', 
                fillerColor: 'rgba(0, 113, 227, 0.1)', 
                handleStyle: { color: '#0071e3' } 
            }
        ],
        legend: { show: series.length > 1, bottom: 40, textStyle: { color: '#86868b' } },
        grid: { top: '15%', left: '5%', right: '5%', bottom: '20%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: xAxisData, 
            axisLine: { lineStyle: { color: '#d2d2d7' } }, 
            axisLabel: { color: '#86868b' }, 
            boundaryGap: type === 'bar' 
        },
        yAxis: { 
            type: 'value', 
            scale: true, 
            splitLine: { lineStyle: { color: '#f5f5f7', type: 'dashed' } }, 
            axisLabel: { color: '#86868b' } 
        },
        series: series
    };
    myChart.setOption(option, true);
}

function newFile() { 
    const pane = 'top';
    const editorElem = document.getElementById(`code-editor-${pane}`);
    if (editorElem) editorElem.value = ''; 
    filenameInput.value = ''; 
    localStorage.removeItem('lastOpenedFile');
    updateLineNumbers(pane);
    if (myChart) myChart.clear();
}

function toggleSidebar() { sidebar.classList.toggle('closed'); setTimeout(() => myChart && myChart.resize(), 350); }
function toggleTerminal() { terminal.classList.toggle('closed'); setTimeout(() => myChart && myChart.resize(), 350); }

initApp();
window.addEventListener('resize', () => myChart && myChart.resize());