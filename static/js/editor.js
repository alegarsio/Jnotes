const editor = document.getElementById('code-editor');
const lineNumbers = document.getElementById('line-numbers');
const consoleBox = document.getElementById('console');
const filenameInput = document.getElementById('filename-input');
const sidebar = document.getElementById('sidebar');
const terminal = document.getElementById('console-container');
let myChart = null;

function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    let numberString = '';
    for (let i = 1; i <= lines; i++) {
        numberString += i + '<br>';
    }
    lineNumbers.innerHTML = numberString;
}

editor.addEventListener('input', updateLineNumbers);
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

async function refreshFileList() {
    const res = await fetch('/list_files');
    const files = await res.json();
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    files.forEach(file => {
        const li = document.createElement('li');
        const icon = document.createElement('img');
        icon.src = "/static/icon.png";
        icon.className = "file-icon";
        
        const span = document.createElement('span');
        span.textContent = file;
        
        li.appendChild(icon);
        li.appendChild(span);
        
        li.onclick = () => {
            document.querySelectorAll('#file-list li').forEach(el => el.classList.remove('active-file'));
            li.classList.add('active-file');
            loadFile(file);
        };
        list.appendChild(li);
    });
}

async function saveFile() {
    const filename = filenameInput.value || 'untitled.jackal';
    await fetch('/save_file', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ filename, content: editor.value }) 
    });
    consoleBox.innerText = `[System] Saved ${filename}`;
    refreshFileList();
}

async function loadFile(name) {
    const res = await fetch(`/load_file/${name}`);
    const data = await res.json();
    editor.value = data.content;
    filenameInput.value = name;
    updateLineNumbers();
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
        try { renderChart(JSON.parse(match[0])); } catch(e) { consoleBox.innerText += "\n[Error] Chart parsing failed."; }
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
                    symbol: 'circle',
                    symbolSize: 8,
                    itemStyle: { color: colors[i % colors.length] },
                    areaStyle: type === 'area' ? {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: colors[i % colors.length] + '66' },
                            { offset: 1, color: colors[i % colors.length] + '00' }
                        ])
                    } : null
                });
                if (data.length > xAxisData.length) {
                    xAxisData = Array.from({length: data.length}, (_, k) => `Data ${k+1}`);
                }
            }
        });
    } else {
        series.push({
            name: 'Analysis',
            type: (type === 'area' || type === 'line') ? 'line' : type,
            data: chartData,
            smooth: true,
            symbol: 'circle',
            symbolSize: 10,
            itemStyle: { color: '#0071e3' },
            areaStyle: type === 'area' ? {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(0, 113, 227, 0.2)' },
                    { offset: 1, color: 'rgba(0, 113, 227, 0)' }
                ])
            } : null
        });
        xAxisData = chartData.map((_, i) => `Data ${i+1}`);
    }

    const option = {
        animationDuration: 1500,
        backgroundColor: 'transparent',
        tooltip: { 
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderWidth: 0,
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.1)'
        },
        legend: { show: series.length > 1, bottom: 0, textStyle: { color: '#86868b' } },
        grid: { top: '10%', left: '5%', right: '5%', bottom: '15%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: xAxisData,
            axisLine: { lineStyle: { color: '#d2d2d7' } },
            axisLabel: { color: '#86868b' }
        },
        yAxis: { 
            type: 'value', 
            splitLine: { lineStyle: { color: '#f5f5f7' } },
            axisLabel: { color: '#86868b' }
        },
        series: series
    };

    myChart.setOption(option, true);
}

function newFile() { 
    editor.value = ''; 
    filenameInput.value = ''; 
    updateLineNumbers();
    if (myChart) myChart.clear();
}

window.addEventListener('resize', () => myChart && myChart.resize());
refreshFileList();