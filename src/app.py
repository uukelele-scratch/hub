from hybridoma import App, portal
from hybridoma.quart import request, redirect
import json
import os
import subprocess as sp
from datetime import datetime
from base64 import a85decode, a85encode
from uuid import uuid4
from openai import AsyncOpenAI as OpenAI
from dotenv import set_key, find_dotenv, load_dotenv

app = App(__name__)

app.config['META_TITLE'] = "Hub."
app.config['META_DESCRIPTION'] = "Hub: A personal-use note-taking app."

@app.context_processor
def inject_common_vars():
    try:
        scheme = request.scheme if hasattr(request, "scheme") else "http"
        host = f"{scheme}://{request.host}"
        url = request.url
    except RuntimeError:
        scheme = "http"
        host = "localhost"
        url = "/"
    return dict(
        host=host,
        url=url,
        meta_title = app.config['META_TITLE'],
        meta_description = app.config['META_DESCRIPTION'],
        meta_image = f"{host}/favicon.ico",
    )

dotenv = find_dotenv()
if not dotenv:
    dotenv = '.env'
    open(dotenv, 'w').close()

load_dotenv()

class Hub:
    config = os.environ

    def __init__(self):
        self.dotenv = find_dotenv()
        if not self.dotenv:
            self.dotenv = '.env'
            open(self.dotenv, 'w').close()
        load_dotenv(self.dotenv)

        self.git = self.config.get("GIT_BINARY", "git")
        self.repo_path = self.config.get("REPO_PATH", 'hub.data')
        self.ai_client = OpenAI(
            api_key = self.config.get("OPENAI_API_KEY"),
            base_url = self.config.get("OPENAI_BASE_URL"),
        )

    def clone(self):
        if os.path.exists(self.repo_path): return

        token = self.config.get("GITHUB_TOKEN")
        repo = self.config.get("REPO_URL")

        result = sp.run([self.git, "clone", f"https://{token}@github.com/{repo}.git", self.repo_path], capture_output=True, text=True, check=True)

        return result.returncode == 0   
   
    def read(self, fp):
        self.clone()
        try:
            with open(os.path.join(self.repo_path, fp), 'rb') as f:
                return f.read()
        except FileNotFoundError:
            open(os.path.join(self.repo_path, fp), 'x').close()
        
    def write(self, fp, data):
        self.clone()
        with open(os.path.join(self.repo_path, fp), 'wb') as f:
            f.write(data)

        for cmd in [
            [self.git, 'add', '.'],
            [self.git, 'commit', '-m', f'sync-{datetime.now()}'],
            [self.git, 'push']
        ]: print(sp.run(cmd, cwd=self.repo_path, capture_output=True, text=True, check=True).stdout)

hub = Hub()

@portal.expose
def settings(new_settings = None):
    safe = {
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "OPENAI_MODEL",

        "GIT_BINARY",
        "GITHUB_TOKEN",
        "REPO_URL",
        "REPO_PATH",
    }
    
    if new_settings:

        new_settings = {k:v for k,v in new_settings.items() if k in safe}

        hub.config.update(new_settings)
        for k, v in new_settings.items():
            set_key(hub.dotenv, k, str(v))
    
    return {k:v for k,v in hub.config.items() if k in safe}

@portal.expose
def clone():
    return hub.clone()

@portal.expose   
def read(fp):
    # Decryption is done in the browser. Master key is never stored here.
    try: return hub.read(fp)
    except: return None

@portal.expose
def write(fp, data):
    return hub.write(fp, data)

@portal.expose
async def chat(messages):
    completion = await hub.ai_client.chat.completions.create(
        model = hub.config.get("OPENAI_MODEL", 'gpt-4o-mini'),
        messages = messages,
        stream=True,
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_note",
                    "description": "Retrieves the content of notes written on a specific day.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "day": {
                                "type": "string",
                                "description": "The 'day' parameter is a date in 'YYYY-MM-DD' format. If 'day' is not provided, it defaults to today's notes."
                            },
                        },
                        "required": [],
                    },
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_all_notes",
                    "description": "Returns a list of dates (in 'YYYY-MM-DD' format) on which notes have been written.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "limit": {
                                "type": "integer",
                                "description": "The 'limit' parameter specifies the maximum number of recent dates to retrieve, counting backward from today. Default limit is 30.",
                            },
                        },
                    },
                }
            },
        ],
    )

    text = ""
    fx_calls = []
    async for chunk in completion:
        delta = chunk.choices[0].delta
        if not delta: continue
        if delta.content:
            text += delta.content
            await portal.chunk(delta.content)
        if delta.tool_calls:
            fx_calls.extend([{'name': fx.function.name, 'arguments': fx.function.arguments} for fx in delta.tool_calls])

    return {
        'role': 'assistant',
        'content': text,
        'fx_calls': fx_calls,
    }

@app.route("/")
async def main():
    return await app.render("index.html")

@app.route("/favicon.ico")
async def favicon():
    return redirect("https://raw.githubusercontent.com/uukelele-scratch/hybridoma/refs/heads/main/.github/assets/hybridoma.png", 301)

if __name__ == "__main__":
    app.run(debug=True, port=8990)