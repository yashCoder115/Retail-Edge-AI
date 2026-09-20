# RetailEdge AI

### Privacy-Preserving Edge AI for Real-Time Retail Intelligence

> Smart India Hackathon 2026

RetailEdge AI is a multi-camera retail intelligence platform that
turns existing CCTV / IP camera infrastructure into an intelligent
operational monitoring system.

The system processes video at the edge and converts raw camera
feeds into actionable insights related to shopper activity, queues,
shelf availability, store congestion, and operational conditions.

The core idea is simple:

**Cameras collect → Edge AI understands → Decision Engine acts → Dashboard informs**

---

## 🎯 The Problem

Most retail stores already have CCTV cameras, but these systems are
primarily used for passive surveillance.

Important operational information is still difficult to obtain
continuously, such as:

- How many shoppers are currently in the store?
- Which areas are becoming crowded?
- How long are customers waiting in queues?
- Which shelves may require replenishment?
- When should additional staff or checkout counters be deployed?
- How can store operations be monitored without collecting
  personal identity data?

RetailEdge AI aims to convert existing camera infrastructure into
a real-time retail intelligence layer.

---

## 💡 Our Solution

RetailEdge AI uses multiple CCTV / IP camera feeds as continuous
visual data sources.

The feeds are processed through an edge AI pipeline to detect,
track, and analyse activity inside different store zones.

The resulting analytics are passed to a decision engine that
identifies operational conditions and generates alerts or
recommendations for store staff.

### Core Pipeline

```text
CCTV / IP Cameras
        ↓
RTSP Video Streams
        ↓
Edge Video Processing
        ↓
Object Detection
        ↓
Multi-Object Tracking
        ↓
┌─────────────────────────────┐
│ Shopper Analytics           │
│ Queue Analytics             │
│ Shelf Analytics             │
│ Footfall & Dwell Analysis   │
└─────────────────────────────┘
        ↓
Analytics & Decision Engine
        ↓
Alerts & Recommendations
        ↓
RetailEdge Dashboard

✨ Key Features
👥 Shopper Intelligence
Real-time shopper detection
Anonymous shopper tracking
Footfall estimation
Dwell-time analysis
Zone-level activity monitoring
Store traffic trends
🧍 Queue Intelligence
Queue length estimation
Waiting-time estimation
Congestion detection
Checkout-area monitoring
Operational recommendations based on queue conditions
🛒 Shelf Intelligence
Shelf occupancy monitoring
Low-stock condition detection
Potential stock-out alerts
Zone-based shelf analysis

The current MVP uses occupancy-based shelf intelligence rather
than exact SKU-level inventory recognition.

🧠 Decision Engine

RetailEdge AI does not stop at detecting events.

The analytics layer feeds a decision engine that converts
conditions into operational recommendations.

Example:

Queue increases
      ↓
Congestion detected
      ↓
Decision Engine
      ↓
Open additional checkout counter

Other examples include:

Deploy additional staff during high footfall
Alert staff when queue congestion crosses a threshold
Trigger restocking alerts for low shelf occupancy
📊 Retail Dashboard

The dashboard brings intelligence from multiple store operations
into a single interface.

It provides:

Real-time KPIs
Shopper analytics
Queue analytics
Shelf analytics
Alerts
Recommendations
Camera monitoring
Reports
System health information
🔐 Privacy by Design

Privacy is a core part of the architecture.

RetailEdge AI is designed around an edge-first processing model.

Camera
   ↓
Edge AI Processing
   ↓
Anonymous Analytics
   ↓
Dashboard
Privacy principles
No facial recognition
No personal identity tracking
Anonymous session-scoped track IDs
Raw video remains at the edge by default
Cloud synchronization is optional
Only anonymized aggregate insights need to leave the edge environment

The goal is to extract operational intelligence without turning
the retail system into an identity-tracking platform.

🧠 AI & Computer Vision

The production-oriented architecture is designed around:

OpenCV — video ingestion and frame processing
YOLO — object detection
ByteTrack / BoT-SORT — multi-object tracking
Edge inference — low-latency local processing

The prototype includes a simulation layer so the complete
analytics and decision workflow can be demonstrated without
requiring physical CCTV infrastructure or dedicated edge hardware
during evaluation.

🛠️ Technology Stack
Layer	Technology
Frontend	React.js
Build Tool	Vite
UI	Tailwind CSS
Backend	FastAPI
Language	Python
Computer Vision	OpenCV
Object Detection	YOLO
Object Tracking	ByteTrack / BoT-SORT
Database	SQLite / PostgreSQL
Camera Input	CCTV / IP Camera / RTSP
Edge Deployment	NVIDIA Jetson / Edge Computer
🖥️ Prototype

The current prototype demonstrates the complete retail intelligence
workflow through simulated camera streams.

Implemented Prototype Modules
Dashboard
Live Vision
Shopper Analytics
Queue Analytics
Shelf Analytics
Decision Engine
Camera Management
Reports
System Health
Dark / Light interface
Privacy indicators
Multi-camera interface

The prototype is designed to demonstrate how the system behaves
when connected to continuous camera feeds.

Demo Architecture
Simulated Camera Sources
          ↓
AI Analytics Simulation
          ↓
Decision Engine
          ↓
RetailEdge Dashboard
Target Deployment Architecture
Multiple CCTV / IP Cameras
          ↓
RTSP Streams
          ↓
Edge Computer / Jetson
          ↓
OpenCV Video Processing
          ↓
YOLO Detection
          ↓
Multi-Object Tracking
          ↓
Retail Analytics
          ↓
Decision Engine
          ↓
FastAPI / Application Layer
          ↓
RetailEdge Dashboard
📁 Project Structure
retailedge-ai/
│
├── apps/
│   ├── web/                  
│   └── api/                    
│
├── backend/                  
│
├── edge/
│   ├── detection/              
│   ├── tracking/               
│   ├── analytics/              
│   └── config/                
├── packages/
│   ├── ui/                     
│   ├── types/                
│   └── config/               
│
├── src/                       
│
├── docs/
│   ├── screenshots/           
│   ├── architecture/          
│   ├── presentation/           
│   ├── research/               
│   └── demo/                   
│
├── frontend-notes/            
│
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── README.md
└── .gitignore

Some directories represent the planned production-oriented
organization of the project. The current prototype remains
functional with its existing application structure.

⚙️ Decision Engine

The MVP includes rule-based operational intelligence.

Condition	System Response
Queue length > 8	Long Queue alert
Queue length > 14	High congestion alert
Low shelf occupancy	Potential stock-out alert
Rapidly increasing footfall	Prepare additional staff

These rules form the initial decision layer and can later be
extended with predictive models and historical store data.

📈 Potential Impact

RetailEdge AI is designed to help stores move from passive
surveillance toward proactive operational intelligence.

Potential benefits include:

Faster response to queue congestion
Better staff allocation
Improved shelf availability
Reduced manual camera monitoring
Better understanding of store traffic
Real-time operational awareness
Privacy-preserving analytics
🚀 Future Scope

The current prototype provides the foundation for a larger
production system.

Planned extensions include:

Live RTSP camera integration
Real-time YOLO inference
Edge deployment on NVIDIA Jetson
SKU-level product detection
Planogram compliance
Advanced queue prediction
Demand forecasting
POS / ERP integration
Cross-camera shopper journey analysis
Multi-store deployment
Centralized retail analytics
Historical trend analysis
Model optimization for edge inference

⚠️ Current Limitations

The prototype intentionally has some limitations.
Simulated Camera Streams
The current submission uses simulated streams to provide a reliable
demonstration environment.
The production architecture is designed to accept continuous
CCTV / IP camera streams through RTSP.

Shelf Intelligence

Current shelf analytics uses ROI-based occupancy estimation.

It does not currently perform complete SKU-level product
classification or exact inventory counting.

Edge Deployment

The production-oriented edge inference pipeline is designed for
deployment on an edge computer such as NVIDIA Jetson, while the
current prototype demonstrates the workflow without requiring
dedicated hardware.

📸 Screenshots

Prototype screenshots are available in:

docs/screenshots/

The collection includes:

Dashboard
Live Vision
Shopper Analytics
Queue Analytics
Shelf Analytics
Decision Engine
Camera Management
Reports
System Health
System Architecture
🎥 Demo

Demo resources and deployment information are maintained under:

docs/demo/
📚 Research & References

Technical references and supporting research are maintained under: docs/research/

Key technologies used in the project include:


React
FastAPI
OpenCV
YOLO
ByteTrack / BoT-SORT
NVIDIA Jetson
RTSP-based camera streaming


👥 Team
RetailEdge AI

Built for Smart India Hackathon 2026.

Problem Statement: SIH26179

Theme: Miscellaneous

Category: Hardware

Team-name: ARGUS2.0

📌 Project Status

Current Stage: Working Prototype

The current prototype demonstrates the complete flow from
simulated camera input to retail analytics, decision-making,
alerts, and dashboard visualization.

The architecture is designed to evolve from the demonstration
environment toward real-world multi-camera edge deployment.