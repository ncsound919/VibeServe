"""LiveReload - Wrap HTML with live-reload and dev server"""
import logging

log = logging.getLogger("VibeServe.features.live_reload")

class LiveReload:
    @staticmethod
    def wrap(html_content: str, refresh_ms: int = 2000) -> str:
        return f"<!-- LiveReload {refresh_ms}ms -->\n{html_content}"

    @staticmethod
    def generate_dev_server(filename: str = "index.html", port: int = 8080) -> str:
        return f"""import http.server
import webbrowser
import threading

def serve():
    handler = http.server.SimpleHTTPRequestHandler
    server = http.server.HTTPServer(('localhost', {port}), handler)
    print(f'Serving at http://localhost:{port}')
    server.serve_forever()

threading.Thread(target=lambda: webbrowser.open('http://localhost:{port}')).start()
serve()
"""
