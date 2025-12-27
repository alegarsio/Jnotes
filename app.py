import os
import subprocess
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

JACKAL_PATH = os.path.join(BASE_DIR, "jackal")

NOTEBOOK_DIR = os.path.join(BASE_DIR, "notebooks")

if not os.path.exists(NOTEBOOK_DIR):
    os.makedirs(NOTEBOOK_DIR)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/list_files', methods=['GET'])
def list_files():
    files = [f for f in os.listdir(NOTEBOOK_DIR) if f.endswith('.jackal')]
    return jsonify(files)

@app.route('/save_file', methods=['POST'])
def save_file():
    data = request.json
    filename = data.get('filename', 'untitled.jackal')
    if not filename.endswith('.jackal'): filename += '.jackal'
    path = os.path.join(NOTEBOOK_DIR, filename)
    with open(path, 'w') as f:
        f.write(data.get('content', ''))
    return jsonify({"status": "success", "message": filename})

@app.route('/load_file/<filename>', methods=['GET'])
def load_file(filename):
    path = os.path.join(NOTEBOOK_DIR, filename)
    if os.path.exists(path):
        with open(path, 'r') as f:
            return jsonify({"content": f.read()})
    return jsonify({"error": "Not found"}), 404

@app.route('/delete_file', methods=['POST'])
def delete_file():
    data = request.json
    filename = data.get('filename')
    filepath = os.path.join(NOTEBOOK_DIR, filename)
    
    if os.path.exists(filepath):
        os.remove(filepath)
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "File not found"}), 404

@app.route('/rename_file', methods=['POST'])
def rename_file():
    data = request.json
    old_name = data.get('old_name')
    new_name = data.get('new_name')
    
    if not new_name.endswith('.jackal'):
        new_name += '.jackal'
        
    old_path = os.path.join(NOTEBOOK_DIR, old_name)
    new_path = os.path.join(NOTEBOOK_DIR, new_name)
    
    if os.path.exists(old_path):
        os.rename(old_path, new_path)
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "File not found"}), 404

@app.route('/run', methods=['POST'])
def run_code():
    code = request.json.get('code')
    temp_path = os.path.join(NOTEBOOK_DIR, "_exec_cache.jackal")
    with open(temp_path, 'w') as f:
        f.write(code)
    try:
        result = subprocess.run([JACKAL_PATH, temp_path], capture_output=True, text=True, timeout=10)
        output = result.stdout if result.stdout else result.stderr
    except Exception as e:
        output = f"Error running interpreter: {str(e)}\nMake sure 'jackal' binary is in {BASE_DIR}"
    return jsonify({"output": output})

if __name__ == '__main__':
    app.run(debug=True, port=5000)