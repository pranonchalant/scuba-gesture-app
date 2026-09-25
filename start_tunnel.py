#!/usr/bin/env python3
"""Start a public ngrok tunnel to the local HTTP server on port 8000."""
import os
import sys

try:
    from pyngrok import ngrok
except ImportError:
    print('pyngrok is not installed. Run: python3 -m pip install pyngrok')
    sys.exit(1)


def main():
    auth_token = os.environ.get('NGROK_AUTHTOKEN') or os.environ.get('NGROK_TOKEN')
    if not auth_token:
        print('Error: NGROK_AUTHTOKEN environment variable is not set.')
        print('Create an ngrok account and set NGROK_AUTHTOKEN before running this script.')
        print('Example: export NGROK_AUTHTOKEN=your_token_here')
        sys.exit(1)

    ngrok.set_auth_token(auth_token)
    print('Starting ngrok tunnel for http://127.0.0.1:8000 ...')
    try:
        tunnel = ngrok.connect(8000, bind_tls=True)
        print('Public URL:', tunnel.public_url)
        print('Press Ctrl+C to stop the tunnel.')
        ngrok_process = ngrok.get_ngrok_process()
        ngrok_process.proc.wait()
    except KeyboardInterrupt:
        print('\nTunnel stopped by user.')
    except Exception as exc:
        print('Failed to start ngrok tunnel:', exc)
        sys.exit(1)


if __name__ == '__main__':
    main()
