const DiagramManager = {
    tooltip: null,

    init() {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'Inter, sans-serif'
        });
        this.createTooltip();
    },

    

    async renderAIDiagram(mermaidSyntax) {
        const aiContainer = document.getElementById('graph-container-ai');
        if (!aiContainer || !mermaidSyntax) return;

        aiContainer.innerHTML = ''; 
        try {
            const { svg } = await mermaid.render(`ai_svg_${Date.now()}`, mermaidSyntax);
            aiContainer.innerHTML = svg;
            this.attachHoverEvents(aiContainer);
            this.switchTab('ai'); 
            this.openPanel();
        } catch (e) {
            aiContainer.innerHTML = '<p class="error">AI failed to generate valid diagram logic</p>';
        }
    },
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'diagram-tooltip';
        document.body.appendChild(this.tooltip);
    },

    async togglePanel() {
        const panel = document.getElementById('diagram-panel');
        if (!panel) return;

        panel.classList.toggle('closed');
        if (!panel.classList.contains('closed')) {
            await this.generate();
        }
    },

    async generate() {
        const code = document.getElementById('code-editor-top').value;
        const container = document.getElementById('graph-container');
        if (!container) return;

        container.innerHTML = '';
        let syntax = 'graph TD\n';
        let nodes = [];
        let edges = [];
        const lines = code.split('\n');

        lines.forEach((line, index) => {
            line = line.trim();
            const varMatch = line.match(/let\s+([a-zA-Z_]\w*)\s*=\s*(.*)/);
            if (varMatch) {
                const varName = varMatch[1];
                const id = `v_${varName}_${index}`;
                nodes.push(`${id}["let ${varName}"]`);
                if (nodes.length > 1) {
                    const prevId = nodes[nodes.length - 2].split('[')[0].trim();
                    edges.push(`${prevId} --> ${id}`);
                }
            }
        });

        if (nodes.length === 0) {
            container.innerHTML = '<p style="color:#666">No variable flow found</p>';
            return;
        }

        syntax += nodes.join('\n') + '\n' + edges.join('\n');

        try {
            const { svg } = await mermaid.render(`svg_${Date.now()}`, syntax);
            container.innerHTML = svg;
            this.attachHoverEvents(container);
        } catch (e) {
            container.innerHTML = '<p style="color:#ff6b6b">Diagram error</p>';
        }
    },

    attachHoverEvents(container) {
        const nodeElements = container.querySelectorAll('.node');
        nodeElements.forEach(el => {
            el.addEventListener('mouseenter', (e) => this.showTooltip(e));
            el.addEventListener('mousemove', (e) => this.moveTooltip(e));
            el.addEventListener('mouseleave', () => this.hideTooltip());
        });
    },

    

    showTooltip(e) {
        if (!window.lastExecutionData) return;
        this.tooltip.style.display = 'block';
        this.tooltip.innerHTML = `
            <b>Live Data Preview</b>
            Size: ${window.lastExecutionData.length} items<br>
            Sample: [${window.lastExecutionData.slice(0, 3)}...]
        `;
    },

    moveTooltip(e) {
        this.tooltip.style.left = (e.pageX + 15) + 'px';
        this.tooltip.style.top = (e.pageY + 15) + 'px';
    },

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => DiagramManager.init());