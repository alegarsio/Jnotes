const editor = document.getElementById('code-editor');
const lineNumbers = document.getElementById('line-numbers');
const consoleBox = document.getElementById('console');
const filenameInput = document.getElementById('filename-input');
const sidebar = document.getElementById('sidebar');
const terminal = document.getElementById('console-container');
const saveStatus = document.getElementById('save-status');
let currentActiveFile = null;

let myChart = null;
let autosaveTimer;

let currentRawData = [];

async function initApp() {
    await refreshFileList();
    const lastFile = localStorage.getItem('lastOpenedFile');
    if (lastFile) {
        loadFile(lastFile);
    }
}

function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    let numberString = '';
    for (let i = 1; i <= lines; i++) {
        numberString += i + '<br>';
    }
    lineNumbers.innerHTML = numberString;
}
function renderTable(chartData) {
    const wrapper = document.getElementById('dynamic-table-wrapper');
    currentRawData = chartData;

    if (!Array.isArray(chartData) || chartData.length === 0) {
        wrapper.innerHTML = '<p class="empty-msg">No data available to preview</p>';
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
        tableHTML += `<tr><td><span style="color:#86868b">#</span> ${r}</td>`;
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
    currentRawData.forEach((val, idx) => {
        csvContent += `${idx},${val}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "notebook_data.csv");
    document.body.appendChild(link);
    link.click();
}
editor.addEventListener('input', () => {
    updateLineNumbers();
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
        saveFile(true);
    }, 1500);
});

editor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = editor.scrollTop;
});

function toggleSidebar() { 
    sidebar.classList.toggle('closed'); 
    setTimeout(() => myChart && myChart.resize(), 350); 
}

function toggleTerminal() { 
    terminal.classList.toggle('closed'); 
    setTimeout(() => myChart && myChart.resize(), 350); 
}

editor.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        editor.value = editor.value.substring(0, start) + "    " + editor.value.substring(editor.selectionEnd);
        editor.selectionStart = editor.selectionEnd = start + 4;
        updateLineNumbers();
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        const start = editor.selectionStart;
        const textBefore = editor.value.substring(0, start);
        const lines = textBefore.split('\n');
        const currentLine = lines[lines.length - 1];
        const indent = currentLine.match(/^\s*/)[0];
        const textAfter = editor.value.substring(editor.selectionEnd);
        
        editor.value = textBefore + '\n' + indent + textAfter;
        editor.selectionStart = editor.selectionEnd = start + 1 + indent.length;
        updateLineNumbers();
    }
});
async function deleteFilePrompt() {
    if (!currentActiveFile) return;
    
    if (confirm(`Apakah Anda yakin ingin menghapus ${currentActiveFile}?`)) {
        const res = await fetch('/delete_file', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ filename: currentActiveFile })
        });
        
        if (res.ok) {
            currentActiveFile = null;
            document.getElementById('file-ops').style.display = 'none';
            newFile(); 
            refreshFileList();
            consoleBox.innerText = "[System] File didelete.";
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
            body: JSON.stringify({ 
                old_name: currentActiveFile, 
                new_name: newName 
            })
        });
        
        if (res.ok) {
            refreshFileList();
            consoleBox.innerText = `[System] File diubah menjadi ${newName}`;
        }
    }
}

async function refreshFileList() {
    const res = await fetch('/list_files');
    const files = await res.json();
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    
    files.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file;
        li.onclick = () => {
            document.querySelectorAll('#file-list li').forEach(el => el.classList.remove('active-file'));
            li.classList.add('active-file');
            currentActiveFile = file; // Simpan file yang sedang aktif
            document.getElementById('file-ops').style.display = 'block'; // Tampilkan menu ops
            loadFile(file);
        };
        list.appendChild(li);
    });
}

async function saveFile(isAutosave = false) {
    const filename = filenameInput.value || 'untitled.jackal';
    if (saveStatus) saveStatus.innerText = "Saving...";
    
    await fetch('/save_file', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ filename, content: editor.value }) 
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

async function loadFile(name) {
    const res = await fetch(`/load_file/${name}`);
    if (res.ok) {
        const data = await res.json();
        editor.value = data.content;
        filenameInput.value = name;
        localStorage.setItem('lastOpenedFile', name);
        updateLineNumbers();
        document.querySelectorAll('#file-list li').forEach(el => {
            if (el.textContent === name) el.classList.add('active-file');
            else el.classList.remove('active-file');
        });
    }
}
async function runCode() {
    terminal.classList.remove('closed');
    consoleBox.innerText = "Executing...";
    const res = await fetch('/run', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ code: editor.value }) 
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
            consoleBox.innerText += "\n[Error] Chart parsing failed."; 
        }
    }
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
            if (Array.isArray(data) && data.length > 0) {
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
                if (data.length > xAxisData.length) {
                    xAxisData = Array.from({length: data.length}, (_, k) => k);
                }
            }
        });
    } else {
        series.push({
            name: 'Analytics',
            type: (type === 'area' || type === 'line') ? 'line' : type,
            data: chartData,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
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
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            borderWidth: 0,
            shadowBlur: 15,
            shadowColor: 'rgba(0,0,0,0.1)',
            axisPointer: { type: 'cross', label: { backgroundColor: '#0071e3' } }
        },
        toolbox: {
            right: 20, top: 0,
            feature: {
                dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Reset' } },
                magicType: { type: ['line', 'bar'], title: { line: 'Line', bar: 'Bar' } },
                restore: { title: 'Restore' },
                saveAsImage: { title: 'Export PNG' }
            }
        },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { 
                type: 'slider', start: 0, end: 100, bottom: 10, height: 20,
                borderColor: 'transparent', fillerColor: 'rgba(0, 113, 227, 0.1)', handleStyle: { color: '#0071e3' }
            }
        ],
        legend: { show: series.length > 1, bottom: 40, textStyle: { color: '#86868b' } },
        grid: { top: '15%', left: '5%', right: '5%', bottom: '20%', containLabel: true },
        xAxis: { type: 'category', data: xAxisData, axisLine: { lineStyle: { color: '#d2d2d7' } }, axisLabel: { color: '#86868b' }, boundaryGap: false },
        yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#f5f5f7', type: 'dashed' } }, axisLabel: { color: '#86868b' } },
        series: series
    };
    myChart.setOption(option, true);
}

function newFile() { 
    editor.value = ''; 
    filenameInput.value = ''; 
    localStorage.removeItem('lastOpenedFile');
    updateLineNumbers();
    if (myChart) myChart.clear();
}

initApp();
window.addEventListener('resize', () => myChart && myChart.resize());