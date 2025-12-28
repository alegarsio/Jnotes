document.addEventListener('DOMContentLoaded', () => {
    mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'dark', 
        securityLevel: 'loose' 
    });
});

function toggleDiagramPanel() {
    const panel = document.getElementById('diagram-panel');
    if (panel) {
        panel.classList.toggle('closed');
        if (!panel.classList.contains('closed')) {
            generateCodeDiagram();
        }
    }
}


async function generateCodeDiagram() {
    const code = document.getElementById('code-editor-top').value;
    const graphContainer = document.getElementById('graph-container');
    if (!graphContainer) return;

    graphContainer.innerHTML = '';
    
    let mermaidSyntax = 'graph TD\n';
    let nodes = new Set();
    let edges = [];
    const lines = code.split('\n');
    let lastVarId = '';

    lines.forEach((line, index) => {
        line = line.trim();
        if (!line || line.startsWith('//')) return;

        const varMatch = line.match(/let\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)/);
        if (varMatch) {
            const varName = varMatch[1];
            const varId = `node_${varName}_${index}`;
            nodes.add(`${varId}["let ${varName}"]`);
            
            if (lastVarId) {
                edges.push(`${lastVarId} --> ${varId}`);
            }
            lastVarId = varId;
        } else {
            const funcMatch = line.match(/\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                const funcId = `func_${funcName}_${index}`;
                nodes.add(`${funcId}{{"${funcName}()"}}`);
                
                if (lastVarId) {
                    edges.push(`${lastVarId} ==> ${funcId}`);
                }
                lastVarId = funcId;
            }
        }
    });

    nodes.forEach(node => mermaidSyntax += `  ${node}\n`);
    edges.forEach(edge => mermaidSyntax += `  ${edge}\n`);

    if (nodes.size === 0) {
        graphContainer.innerHTML = '<p style="color:#666; font-size:13px;">No data flow detected.</p>';
        return;
    }

    try {
        mermaid.initialize({ 
            startOnLoad: false, 
            theme: 'dark',
            fontFamily: 'Inter, sans-serif'
        });
        
        const uniqueId = `svg_${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, mermaidSyntax);
        graphContainer.innerHTML = svg;
    } catch (error) {
        console.error("Mermaid Error:", error);
        graphContainer.innerHTML = '<p style="color:#ff6b6b; font-size:13px;">Diagram generation failed. Check code syntax.</p>';
    }
}