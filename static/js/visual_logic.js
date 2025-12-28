const VisualLogic = {
    workspace: null,
    generator: new Blockly.Generator('JACKAL'),

    init() {
        this.defineBlocks();
        this.initGenerator();
        this.injectWorkspace();
    },

    defineBlocks() {
        Blockly.defineBlocksWithJsonArray([
            {
                "type": "jackal_node_data",
                "message0": "DATA SOURCE %1",
                "args0": [{ "type": "field_input", "name": "VAL", "text": "10, 20, 30, 40, 50" }],
                "output": "Array",
                "colour": "#2ecc71"
            },
            {
                "type": "jackal_node_process",
                "message0": "SMOOTH %1 FACTOR %2",
                "args0": [
                    { "type": "input_value", "name": "INPUT", "check": "Array" },
                    { "type": "field_number", "name": "FACT", "value": 3 }
                ],
                "output": "Array",
                "colour": "#3498db"
            },
            {
                "type": "jackal_node_out",
                "message0": "TERMINAL OUT %1",
                "args0": [{ "type": "input_value", "name": "DATA", "check": "Array" }],
                "previousStatement": null,
                "nextStatement": null,
                "colour": "#e74c3c"
            }
        ]);
    },

    initGenerator() {
        this.generator.PRECEDENCE = 0;
        
        this.generator.forBlock['jackal_node_data'] = (block) => {
            const val = block.getFieldValue('VAL') || '0';
            return [`[${val}]`, 0]; 
        };

        this.generator.forBlock['jackal_node_process'] = (block) => {
            const input = this.generator.valueToCode(block, 'INPUT', 0) || '[]';
            const fact = block.getFieldValue('FACT') || '3';
            const code = `Array(${input}).smooth(${fact}).collect()`;
            return [code, 0];
        };

        this.generator.forBlock['jackal_node_out'] = (block) => {
            const data = this.generator.valueToCode(block, 'DATA', 0) || '[]';
            return `println(${data})\n`;
        };

        this.generator.scrub_ = function(block, code, opt_thisOnly) {
            const nextBlock = block.getNextBlock();
            const nextCode = opt_thisOnly ? '' : VisualLogic.generator.blockToCode(nextBlock);
            return code + nextCode;
        };
    },

    injectWorkspace() {
        this.workspace = Blockly.inject('blockly-container', {
            toolbox: {
                "kind": "flyoutToolbox",
                "contents": [
                    { "kind": "block", "type": "jackal_node_data" },
                    { "kind": "block", "type": "jackal_node_process" },
                    { "kind": "block", "type": "jackal_node_out" }
                ]
            },
            theme: 'dark',
            grid: { spacing: 25, length: 3, colour: '#333', snap: true },
            zoom: { controls: true, wheel: true, startScale: 1.0 },
            trashcan: true
        });
        window.addEventListener('resize', () => Blockly.svgResize(this.workspace));
    },

    async runBlueprint() {
        const code = this.generator.workspaceToCode(this.workspace);
        const consoleBox = document.getElementById('console');
        
        if (consoleBox) consoleBox.innerText = "Processing blueprint...";

        try {
            const res = await fetch('/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });
            const data = await res.json();
            
            if (consoleBox) consoleBox.innerText = data.output;
            
            const match = data.output.match(/\[\[.*\]\]|\[.*\]/s);
            if (match && typeof renderChart === 'function') {
                renderChart(JSON.parse(match[0]));
            }
        } catch (e) {
            if (consoleBox) consoleBox.innerText = "Execution failed.";
        }
    }
};

document.addEventListener('DOMContentLoaded', () => VisualLogic.init());