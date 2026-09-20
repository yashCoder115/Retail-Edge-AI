# Research & References

This directory contains the research material and technical references used during the development of **RetailEdge AI** for Smart India Hackathon 2026.

The purpose of this section is to document the technologies, approaches, and supporting resources considered for the proposed retail intelligence platform.

---

## Research Areas

### 1. Edge AI & Computer Vision

Research focused on running AI inference close to the camera/source instead of sending continuous raw video to a remote cloud server.

Key areas:

- Edge AI inference
- Real-time computer vision
- On-device video processing
- Low-latency analytics
- Privacy-preserving AI

---

### 2. Object Detection

Object detection forms the foundation of the RetailEdge AI vision pipeline.

The system is designed around detection of relevant retail entities such as:

- Shoppers
- Retail staff
- Products / shelf regions
- Other objects relevant to store analytics

The production architecture is designed to support modern object detection models such as YOLO.

---

### 3. Object Tracking

Tracking is required to maintain anonymous identities across video frames and derive temporal metrics.

Research areas include:

- Multi-object tracking
- Track IDs
- Shopper movement
- Dwell-time estimation
- Entry / exit tracking
- Queue movement

Potential production technologies include ByteTrack and BoT-SORT.

---

### 4. Retail Analytics

The platform combines computer vision outputs with business-oriented analytics.

Key research areas:

- Footfall analysis
- Shopper dwell time
- Queue length
- Waiting-time estimation
- Shelf occupancy
- Stock availability indicators
- Store congestion
- Operational alerts

---

### 5. Decision Intelligence

Detection alone is not sufficient for retail operations.

RetailEdge AI converts analytics into actionable recommendations through a rule-based decision engine.

Example decision areas:

- Queue congestion
- Additional counter requirement
- Staff allocation
- Low shelf occupancy
- Increasing customer footfall

---

### 6. Privacy-Preserving Analytics

Privacy is considered a core architectural requirement.

The proposed deployment architecture follows the principle of processing video locally at the edge wherever possible.

Design considerations:

- No facial recognition
- Anonymous tracking IDs
- No unnecessary identity information
- Raw video remains local where possible
- Only required metrics and events are shared with dashboards or cloud services

---

## Current Prototype vs Production Research

The current prototype uses simulated video/analytics so that the complete dashboard and decision workflow can be demonstrated without requiring a physical CCTV installation or dedicated edge device.

The intended production pipeline is:

```text
CCTV / IP Cameras
        ↓
RTSP Video Streams
        ↓
Edge Computer
        ↓
OpenCV Video Processing
        ↓
Object Detection
        ↓
Multi-Object Tracking
        ↓
Retail Analytics
        ↓
Decision Engine
        ↓
Dashboard & Alerts

This distinction is maintained to avoid presenting simulated prototype functionality as a fully deployed production system.

Technology Areas
Area	Technologies / Approaches
Computer Vision	OpenCV
Object Detection	YOLO
Object Tracking	ByteTrack / BoT-SORT
Backend	FastAPI
Frontend	React
Data Visualization	Recharts
Database	SQLite / PostgreSQL
Edge Deployment	NVIDIA Jetson / Edge Computer
Camera Input	CCTV / IP Camera / RTSP
Development	Python, JavaScript
Purpose

The research collected in this directory supports the technical decisions behind RetailEdge AI and provides references for further development of the prototype into a deployable multi-camera retail intelligence platform.