import smtplib
import ssl
from email.message import EmailMessage
from typing import List, Optional
import mimetypes
import os
from dotenv import load_dotenv

# Explicitly load .env from the script's directory (atliq-hr-assist), even if executed from outside
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

if not os.getenv("CB_EMAIL") or not os.getenv("CB_EMAIL_PWD"):
    raise ValueError("Missing 'CB_EMAIL' or 'CB_EMAIL_PWD' environment variables. Check your .env file!")

class EmailSender:
    def __init__(
        self,
        smtp_server: str,
        port: int,
        username: str,
        password: str,
        use_tls: bool = True,
    ):
        self.smtp_server = smtp_server
        self.port = port
        self.username = username
        self.password = password
        self.use_tls = use_tls

    def send_email(
        self,
        subject: str,
        body: str,
        to_emails: List[str] | str,
        from_email: Optional[str] = None,
        html: bool = False,
        attachments: Optional[List[str]] = None,
    ) -> None:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_email or self.username
        msg["To"] = ", ".join(to_emails) if isinstance(to_emails, list) else to_emails
        msg.set_content(body, subtype="html" if html else "plain")

        if attachments:
            for file_path in attachments:
                if not os.path.isfile(file_path):
                    raise FileNotFoundError(f"Attachment not found: {file_path}")

                mime_type, _ = mimetypes.guess_type(file_path)
                mime_type = mime_type or "application/octet-stream"
                maintype, subtype = mime_type.split("/", 1)

                with open(file_path, "rb") as f:
                    file_data = f.read()
                    filename = os.path.basename(file_path)
                    msg.add_attachment(file_data, maintype=maintype, subtype=subtype, filename=filename)

        context = ssl.create_default_context()

        try:
            if self.use_tls:
                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls(context=context)
                    server.login(self.username, self.password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP_SSL(self.smtp_server, self.port, context=context) as server:
                    server.login(self.username, self.password)
                    server.send_message(msg)
        except smtplib.SMTPAuthenticationError as e:
            print(f"\n[EMAIL FAILED] Google SMTP rejected your login credentials.")
            print(f"Error Code: {e.smtp_code}")
            print(f"Reason: Your App Password ('{self.password}') for email '{self.username}' is either incorrect, expired, or blocked.")
            print("To Fix this: Go to your Google Account -> Security -> 2-Step Verification -> App Passwords. Generate a new 16-character password and replace it in your .env file!\n")
            raise

if __name__ == "__main__":
    email_sender = EmailSender(
        smtp_server="smtp.gmail.com",
        port=587,
        username=os.getenv("CB_EMAIL"),
        password=os.getenv("CB_EMAIL_PWD"),
        use_tls=True
    )
    email_sender.send_email(
        subject="Test Email",
        body="This is a test email.",
        to_emails="xejic66208@nexafilm.com"
    )
    print("Email sent successfully!")
