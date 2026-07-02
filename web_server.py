import os
import sys
import datetime
import logging
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Ensure parent directory is in sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from emails import EmailSender
from hrms import (
    EmployeeManager,
    LeaveManager,
    MeetingManager,
    TicketManager,
    EmployeeCreate,
    LeaveApplyRequest,
    MeetingCreate,
    MeetingCancelRequest,
    TicketCreate,
    TicketStatusUpdate
)
from utils import seed_services

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("atliq-web-server")

# Load environment
from dotenv import load_dotenv
load_dotenv()

# Initialize managers
employee_manager = EmployeeManager()
meeting_manager = MeetingManager()
leave_manager = LeaveManager()
ticket_manager = TicketManager()

# Seed services
seed_services(employee_manager, meeting_manager, leave_manager, ticket_manager)

# Setup emailer
emailer = EmailSender(
    smtp_server="smtp.gmail.com",
    port=587,
    username=os.getenv("CB_EMAIL") or "test@atliq.com",
    password=os.getenv("CB_EMAIL_PWD") or "password",
    use_tls=True
)

app = FastAPI(title="Atliq HR Assist API", description="Backend API for Atliq HR Assist Dashboard")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to send email with local file fallback
def send_email_wrapper(to_emails: List[str], subject: str, body: str) -> str:
    username = os.getenv("CB_EMAIL")
    password = os.getenv("CB_EMAIL_PWD")
    
    # Ensure sent_emails folder exists
    os.makedirs("sent_emails", exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_subject = "".join([c if c.isalnum() else "_" for c in subject])[:50]
    filename = f"sent_emails/email_{timestamp}_{safe_subject}.txt"
    
    email_log = f"To: {', '.join(to_emails)}\nSubject: {subject}\nBody:\n{body}\n"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(email_log)
        
    if not username or not password or "example" in username or "your-email" in username:
        logger.info(f"[SIMULATED EMAIL] {subject} to {to_emails}")
        return f"Simulated email sent to {', '.join(to_emails)}. Logged to {filename}."
        
    try:
        emailer.send_email(subject, body, to_emails, from_email=username, html=False)
        logger.info(f"[EMAIL SENT] {subject} to {to_emails}")
        return f"Email sent successfully to {', '.join(to_emails)}."
    except Exception as e:
        logger.error(f"Failed to send real email: {e}")
        return f"Failed to send real email ({e}). Simulated email logged to {filename}."

class LoginRequest(BaseModel):
    username: str
    password: str

# API Endpoints

@app.post("/api/auth/login")
def login(request: LoginRequest):
    username = request.username.strip().lower()
    password = request.password.strip()
    
    # Check credentials
    if (username == "admin" and password == "admin") or \
       (username == "sarah.johnson@atliq.com" and password == "admin") or \
       (username == "sarah" and password == "admin"):
        return {
            "status": "success",
            "token": "atliq-mock-token-sarah-12345",
            "user": {
                "name": "Sarah Johnson",
                "email": "sarah.johnson@atliq.com",
                "role": "HR Director",
                "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop"
            }
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

@app.get("/api/dashboard")
def get_dashboard():
    # Calculate stats
    total_employees = len(employee_manager.employees)
    
    balances = [data["balance"] for data in leave_manager.employee_leaves.values()]
    avg_leave_bal = round(sum(balances) / len(balances), 1) if balances else 20.0
    
    total_meetings = sum(len(m) for m in meeting_manager.meetings.values())
    total_tickets = len(ticket_manager.tickets)
    
    open_tickets = sum(1 for t in ticket_manager.tickets if t["status"] == "Open")
    in_progress_tickets = sum(1 for t in ticket_manager.tickets if t["status"] == "In Progress")
    closed_tickets = sum(1 for t in ticket_manager.tickets if t["status"] == "Closed")
    
    # Recent tickets (last 5)
    recent_tickets = sorted(
        ticket_manager.tickets,
        key=lambda x: x.get("created_at", ""),
        reverse=True
    )[:5]
    
    # Format and collect meetings
    all_meetings = []
    for emp_id, emp_meetings in meeting_manager.meetings.items():
        emp_name = employee_manager.employees.get(emp_id, {}).get("name", "Unknown")
        for m in emp_meetings:
            all_meetings.append({
                "emp_id": emp_id,
                "emp_name": emp_name,
                "title": m.get("title") or m.get("topic") or "Meeting",
                "date": m.get("date"),
                "time": m.get("time", "N/A"),
                "location": m.get("location", "N/A"),
                "topic": m.get("topic", "")
            })
            
    recent_meetings = sorted(
        all_meetings,
        key=lambda x: (x["date"], x["time"])
    )[:5]
    
    return {
        "stats": {
            "total_employees": total_employees,
            "avg_leave_balance": avg_leave_bal,
            "total_meetings": total_meetings,
            "total_tickets": total_tickets,
            "tickets_status": {
                "Open": open_tickets,
                "InProgress": in_progress_tickets,
                "Closed": closed_tickets
            }
        },
        "recent_tickets": recent_tickets,
        "recent_meetings": recent_meetings
    }

@app.get("/api/employees")
def get_employees():
    employee_list = []
    for emp_id, details in employee_manager.employees.items():
        mgr_id = details.get("manager_id")
        mgr_name = employee_manager.employees.get(mgr_id, {}).get("name", "N/A") if mgr_id else "None"
        employee_list.append({
            "emp_id": emp_id,
            "name": details.get("name"),
            "email": details.get("email"),
            "manager_id": mgr_id,
            "manager_name": mgr_name
        })
    # Sort by employee ID
    employee_list.sort(key=lambda x: x["emp_id"])
    return employee_list
@app.get("/api/employees/{emp_id}/profile")
def get_employee_profile(emp_id: str):
    if emp_id not in employee_manager.employees:
        raise HTTPException(status_code=404, detail="Employee not found.")
    
    details = employee_manager.get_employee_details(emp_id)
    
    # Manager details
    mgr_id = details.get("manager_id")
    mgr_name = employee_manager.employees.get(mgr_id, {}).get("name", "N/A") if mgr_id else "None"
    
    # Direct reports
    direct_reports = []
    for report_id in employee_manager.get_direct_reports(emp_id):
        rep = employee_manager.employees.get(report_id)
        if rep:
            direct_reports.append({
                "emp_id": report_id,
                "name": rep.get("name")
            })
            
    # Leave balance & history
    leave_data = leave_manager.employee_leaves.get(emp_id, {"balance": 20, "history": []})
    leave_balance = leave_data.get("balance", 20)
    leave_history = []
    for idx, item in enumerate(leave_data.get("history", [])):
        if isinstance(item, dict):
            leave_date_val = item.get("leave_date")
            if isinstance(leave_date_val, (datetime.date, datetime.datetime)):
                date_str = leave_date_val.strftime("%Y-%m-%d")
            else:
                date_str = str(leave_date_val)
        else:
            date_str = str(item)
        leave_history.append(date_str)
        
    # Meetings
    emp_meetings = []
    for m in meeting_manager.meetings.get(emp_id, []):
        emp_meetings.append({
            "title": m.get("title") or m.get("topic") or "Meeting",
            "date": m.get("date"),
            "time": m.get("time", "N/A"),
            "location": m.get("location", "N/A")
        })
        
    # Tickets
    emp_tickets = []
    for t in ticket_manager.tickets:
        if t["emp_id"] == emp_id:
            emp_tickets.append({
                "ticket_id": t["ticket_id"],
                "item": t["item"],
                "status": t["status"],
                "reason": t["reason"]
            })
            
    return {
        "emp_id": emp_id,
        "name": details.get("name"),
        "email": details.get("email"),
        "manager_id": mgr_id,
        "manager_name": mgr_name,
        "direct_reports": direct_reports,
        "leave_balance": leave_balance,
        "leave_history": leave_history,
        "meetings": emp_meetings,
        "tickets": emp_tickets
    }


class CreateEmployeePayload(BaseModel):
    name: str
    email: str
    manager_id: Optional[str] = None

@app.post("/api/employees")
def create_employee(payload: CreateEmployeePayload):
    try:
        emp_id = employee_manager.get_next_emp_id()
        # Verify manager exists if provided
        if payload.manager_id and payload.manager_id not in employee_manager.employees:
            raise HTTPException(status_code=400, detail=f"Manager ID {payload.manager_id} not found.")
            
        emp = EmployeeCreate(
            emp_id=emp_id,
            name=payload.name,
            email=payload.email,
            manager_id=payload.manager_id if payload.manager_id else None
        )
        employee_manager.add_employee(emp)
        
        # Initialize leave balance for new employee
        leave_manager.employee_leaves[emp_id] = {"balance": 20, "history": []}
        
        return {
            "status": "success",
            "message": f"Employee {payload.name} created successfully.",
            "employee": {
                "emp_id": emp_id,
                "name": payload.name,
                "email": payload.email,
                "manager_id": payload.manager_id or None,
                "manager_name": employee_manager.employees.get(payload.manager_id, {}).get("name", "N/A") if payload.manager_id else "None"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/leaves")
def get_leaves():
    leaves_data = []
    for emp_id, details in leave_manager.employee_leaves.items():
        emp_name = employee_manager.employees.get(emp_id, {}).get("name", "Unknown")
        hist = details.get("history", [])
        
        formatted_history = []
        for idx, item in enumerate(hist):
            if isinstance(item, dict):
                leave_date_val = item.get("leave_date")
                if isinstance(leave_date_val, (datetime.date, datetime.datetime)):
                    date_str = leave_date_val.strftime("%Y-%m-%d")
                else:
                    date_str = str(leave_date_val)
                req_id = item.get("request_id", idx + 1)
            else:
                date_str = str(item)
                req_id = idx + 1
                
            formatted_history.append({
                "date": date_str,
                "request_id": req_id
            })
            
        leaves_data.append({
            "emp_id": emp_id,
            "emp_name": emp_name,
            "balance": details.get("balance", 20),
            "history": formatted_history
        })
    return leaves_data

class ApplyLeavePayload(BaseModel):
    emp_id: str
    start_date: str # YYYY-MM-DD
    end_date: str # YYYY-MM-DD

@app.post("/api/leaves/apply")
def apply_leave_api(payload: ApplyLeavePayload):
    try:
        if payload.emp_id not in employee_manager.employees:
            raise HTTPException(status_code=404, detail="Employee not found.")
            
        try:
            start = datetime.datetime.strptime(payload.start_date, "%Y-%m-%d").date()
            end = datetime.datetime.strptime(payload.end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
            
        if start > end:
            raise HTTPException(status_code=400, detail="Start date must be before or equal to End date.")
            
        delta = end - start
        dates = [start + datetime.timedelta(days=i) for i in range(delta.days + 1)]
                
        req = LeaveApplyRequest(emp_id=payload.emp_id, leave_dates=dates)
        result = leave_manager.apply_leave(req)
        return {"status": "success", "message": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/meetings")
def get_meetings_api():
    meeting_list = []
    for emp_id, emp_meetings in meeting_manager.meetings.items():
        emp_name = employee_manager.employees.get(emp_id, {}).get("name", "Unknown")
        for m in emp_meetings:
            meeting_list.append({
                "emp_id": emp_id,
                "emp_name": emp_name,
                "title": m.get("title") or m.get("topic") or "Meeting",
                "date": m.get("date"),
                "time": m.get("time", "N/A"),
                "location": m.get("location", "N/A"),
                "topic": m.get("topic", "")
            })
    meeting_list.sort(key=lambda x: (x["date"], x["time"]))
    return meeting_list

class ScheduleMeetingPayload(BaseModel):
    emp_id: str
    meeting_datetime: str # ISO string (e.g. 2026-07-03T10:00:00)
    topic: str

@app.post("/api/meetings/schedule")
def schedule_meeting_api(payload: ScheduleMeetingPayload):
    try:
        if payload.emp_id not in employee_manager.employees:
            raise HTTPException(status_code=404, detail="Employee not found.")
            
        try:
            dt = datetime.datetime.fromisoformat(payload.meeting_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO format (YYYY-MM-DDTHH:MM:SS)")
            
        req = MeetingCreate(emp_id=payload.emp_id, meeting_dt=dt, topic=payload.topic)
        result = meeting_manager.schedule_meeting(req)
        return {"status": "success", "message": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class CancelMeetingPayload(BaseModel):
    emp_id: str
    meeting_datetime: str
    topic: Optional[str] = None

@app.post("/api/meetings/cancel")
def cancel_meeting_api(payload: CancelMeetingPayload):
    try:
        try:
            dt = datetime.datetime.fromisoformat(payload.meeting_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO format.")
            
        req = MeetingCancelRequest(emp_id=payload.emp_id, meeting_dt=dt, topic=payload.topic)
        result = meeting_manager.cancel_meeting(req)
        return {"status": "success", "message": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class RescheduleMeetingPayload(BaseModel):
    emp_id: str
    old_datetime: str # ISO string (original time)
    new_datetime: str # ISO string (new time)
    topic: str

@app.post("/api/meetings/reschedule")
def reschedule_meeting_api(payload: RescheduleMeetingPayload):
    try:
        if payload.emp_id not in employee_manager.employees:
            raise HTTPException(status_code=404, detail="Employee not found.")
            
        try:
            old_dt = datetime.datetime.fromisoformat(payload.old_datetime)
            new_dt = datetime.datetime.fromisoformat(payload.new_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO format (YYYY-MM-DDTHH:MM:SS)")
            
        # Find the meeting to update
        emp_meetings = meeting_manager.meetings.get(payload.emp_id, [])
        meeting_to_update = None
        for m in emp_meetings:
            m_date = m.get("date", "")
            if "T" in m_date:
                m_dt = datetime.datetime.fromisoformat(m_date)
            else:
                m_time = m.get("time", "00:00")
                m_dt = datetime.datetime.fromisoformat(f"{m_date}T{m_time}")
                
            if m_dt.replace(second=0, microsecond=0) == old_dt.replace(second=0, microsecond=0):
                meeting_to_update = m
                break
                
        if not meeting_to_update:
            raise HTTPException(status_code=404, detail="Meeting at original datetime not found.")
            
        # Check conflict for new datetime (excluding the updated meeting itself)
        new_dt_str = new_dt.isoformat()
        conflict_found = False
        for m in emp_meetings:
            if m is meeting_to_update:
                continue
            m_date = m.get("date", "")
            if "T" in m_date:
                m_dt = datetime.datetime.fromisoformat(m_date)
            else:
                m_time = m.get("time", "00:00")
                m_dt = datetime.datetime.fromisoformat(f"{m_date}T{m_time}")
            if m_dt.replace(second=0, microsecond=0) == new_dt.replace(second=0, microsecond=0):
                conflict_found = True
                break
                
        if conflict_found:
            raise HTTPException(status_code=400, detail=f"Conflict: Employee already has a meeting scheduled at {new_dt_str}.")
            
        # Update details in original format
        if "time" in meeting_to_update:
            meeting_to_update["date"] = new_dt.strftime("%Y-%m-%d")
            meeting_to_update["time"] = new_dt.strftime("%H:%M")
        else:
            meeting_to_update["date"] = new_dt_str
            
        meeting_to_update["topic"] = payload.topic
        meeting_to_update["title"] = payload.topic
        
        return {"status": "success", "message": f"Meeting successfully rescheduled to {new_dt_str}."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/tickets")
def get_tickets_api():
    tickets_list = []
    for t in ticket_manager.tickets:
        emp_name = employee_manager.employees.get(t["emp_id"], {}).get("name", "Unknown")
        tickets_list.append({
            "ticket_id": t["ticket_id"],
            "emp_id": t["emp_id"],
            "emp_name": emp_name,
            "item": t["item"],
            "reason": t["reason"],
            "status": t["status"],
            "created_at": t.get("created_at"),
            "updated_at": t.get("updated_at")
        })
    # Sort tickets by ID descending (newest first)
    tickets_list.sort(key=lambda x: x["ticket_id"], reverse=True)
    return tickets_list

class CreateTicketPayload(BaseModel):
    emp_id: str
    item: str
    reason: str

@app.post("/api/tickets")
def create_ticket_api(payload: CreateTicketPayload):
    try:
        if payload.emp_id not in employee_manager.employees:
            raise HTTPException(status_code=404, detail="Employee not found.")
            
        req = TicketCreate(emp_id=payload.emp_id, item=payload.item, reason=payload.reason)
        result = ticket_manager.create_ticket(req)
        return {"status": "success", "message": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class UpdateTicketStatusPayload(BaseModel):
    status: str # 'Open', 'In Progress', 'Closed', 'Rejected'

@app.put("/api/tickets/{ticket_id}/status")
def update_ticket_status_api(ticket_id: str, payload: UpdateTicketStatusPayload):
    try:
        req = TicketStatusUpdate(status=payload.status)
        result = ticket_manager.update_ticket_status(req, ticket_id)
        return {"status": "success", "message": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class OnboardPayload(BaseModel):
    employee_name: str
    manager_name: str
    email: str

@app.post("/api/onboard")
def onboard_employee_api(payload: OnboardPayload):
    logs = []
    
    def log_step(step_num: int, title: str, status: str, detail: str):
        logs.append({
            "step": step_num,
            "title": title,
            "status": status,
            "detail": detail
        })
        logger.info(f"Onboarding Step {step_num}: {title} [{status}] - {detail}")

    try:
        # Step 1: Search Manager ID by name
        step = 1
        title = "Identify Manager ID"
        manager_matches = employee_manager.search_employee_by_name(payload.manager_name)
        if not manager_matches:
            log_step(step, title, "FAILED", f"No manager found with name '{payload.manager_name}'. Onboarding aborted.")
            return {"status": "failed", "logs": logs}
        
        manager_id = manager_matches[0]
        mgr_details = employee_manager.get_employee_details(manager_id)
        log_step(step, title, "SUCCESS", f"Found manager '{mgr_details['name']}' with ID {manager_id}.")
        
        # Step 2: Add the employee
        step = 2
        title = "Add Employee to Database"
        new_emp_id = employee_manager.get_next_emp_id()
        emp_create_req = EmployeeCreate(
            emp_id=new_emp_id,
            name=payload.employee_name,
            email=payload.email,
            manager_id=manager_id
        )
        employee_manager.add_employee(emp_create_req)
        # Initialize leave balance
        leave_manager.employee_leaves[new_emp_id] = {"balance": 20, "history": []}
        log_step(step, title, "SUCCESS", f"Added employee {payload.employee_name} with ID {new_emp_id}.")

        # Step 3: Send welcome email to the employee
        step = 3
        title = "Send Welcome Email"
        subject = f"Welcome to Atliq Technologies, {payload.employee_name}!"
        body = f"""Hi {payload.employee_name},

Welcome to Atliq Technologies! We are absolutely thrilled to have you join our team.

Your Employee ID is {new_emp_id}.
Your reporting manager is {mgr_details['name']} ({mgr_details.get('email', 'N/A')}).

If you have any questions or require initial support, please reach out to the HR Helpdesk.

Best Regards,
HR Team
Atliq Technologies"""
        email_res = send_email_wrapper([payload.email], subject, body)
        log_step(step, title, "SUCCESS", email_res)

        # Step 4: Notify manager about onboarding
        step = 4
        title = "Notify Manager"
        mgr_subject = f"New Onboarding: {payload.employee_name} joins your team"
        mgr_body = f"""Hi {mgr_details['name']},

This is to notify you that your new direct report, {payload.employee_name}, has been successfully onboarded in our HR system.

Employee Details:
- Name: {payload.employee_name}
- Employee ID: {new_emp_id}
- Email: {payload.email}

Please make sure to schedule a sync-up meeting on their first day.

Best Regards,
HR Team
Atliq Technologies"""
        
        if mgr_details.get('email'):
            mgr_email_res = send_email_wrapper([mgr_details['email']], mgr_subject, mgr_body)
            log_step(step, title, "SUCCESS", mgr_email_res)
        else:
            log_step(step, title, "SKIPPED", "Manager has no email address.")

        # Step 5: Raise IT support tickets (Laptop, ID Card, etc.)
        step = 5
        title = "Raise IT Assets Tickets"
        t1_res = ticket_manager.create_ticket(TicketCreate(emp_id=new_emp_id, item="MacBook Pro 16", reason="New joiner workstation setup"))
        t2_res = ticket_manager.create_ticket(TicketCreate(emp_id=new_emp_id, item="Atliq Security ID Card", reason="Employee building access badge"))
        log_step(step, title, "SUCCESS", f"Created IT tickets: '{t1_res}' & '{t2_res}'")

        # Step 6: Schedule introductory meeting
        step = 6
        title = "Schedule Intro Meeting"
        tomorrow = datetime.datetime.now() + datetime.timedelta(days=1)
        meeting_time = tomorrow.replace(hour=11, minute=0, second=0, microsecond=0)
        meeting_req = MeetingCreate(
            emp_id=new_emp_id,
            meeting_dt=meeting_time,
            topic="HR Onboarding Sync & Intro"
        )
        meet_res = meeting_manager.schedule_meeting(meeting_req)
        log_step(step, title, "SUCCESS", meet_res)

        # Step 7: Notify employee and manager of the meeting
        step = 7
        title = "Email Meeting Invitations"
        invite_subject = f"Onboarding Intro Meeting: {payload.employee_name} / {mgr_details['name']}"
        invite_body = f"""Hi,

You are invited to an introductory HR meeting.

Topic: HR Onboarding Sync & Intro
Time: {meeting_time.strftime('%B %d, %Y at %I:%M %p')}
Location: Zoom Link / Virtual

Participants:
- New Employee: {payload.employee_name} ({payload.email})
- Manager: {mgr_details['name']} ({mgr_details.get('email', 'N/A')})

See you there!

HR Operations"""
        
        recipients = [payload.email]
        if mgr_details.get('email'):
            recipients.append(mgr_details['email'])
            
        invite_email_res = send_email_wrapper(recipients, invite_subject, invite_body)
        log_step(step, title, "SUCCESS", invite_email_res)

        # Step 8: Get leave balance & Apply for trial leave
        step = 8
        title = "Leave Setup & Trial Application"
        bal_str = leave_manager.get_leave_balance(new_emp_id)
        
        # Apply for trial leave next week
        trial_leave_date = tomorrow + datetime.timedelta(days=5)
        leave_req = LeaveApplyRequest(emp_id=new_emp_id, leave_dates=[trial_leave_date.date()])
        apply_res = leave_manager.apply_leave(leave_req)
        
        log_step(step, title, "SUCCESS", f"Initial Balance: '{bal_str}'. Applied trial leave for {trial_leave_date.date().isoformat()}: '{apply_res}'")

        # Step 9: Get leave history
        step = 9
        title = "Verify Leave History"
        hist_str = leave_manager.get_leave_history(new_emp_id)
        log_step(step, title, "SUCCESS", f"Retrieved Leave History: {hist_str}")

        return {"status": "success", "logs": logs}
        
    except Exception as e:
        log_step(9, "Onboarding Process", "ERROR", f"An unexpected error occurred: {e}")
        return {"status": "failed", "logs": logs}

# Mount static folder
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    # Run server on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
