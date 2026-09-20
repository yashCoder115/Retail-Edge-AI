# RetailEdge AI — Demo Guide

This guide explains how to access and demonstrate the RetailEdge AI prototype.

---

## 1. Access the Deployed Prototype

The RetailEdge AI prototype is deployed as a web application and can be accessed directly through a browser.

### Live Demo

**Deployment URL:**  
https://retail-edge-ai.vercel.app/

No installation is required to access the deployed prototype.

---

## 2. Local Development (Optional)

For development, testing, or evaluation of the source code, the project can also be run locally.

### Prerequisites

Make sure the following are installed:

- Node.js
- npm
- Git

### Run the Project

Open a terminal in the project root:

```bash
npm install
npm run dev

3. Prototype Demo Flow

The recommended demonstration sequence is:

Dashboard
   ↓
Live Vision
   ↓
Shopper Analytics
   ↓
Queue Analytics
   ↓
Shelf Analytics
   ↓
Decision Engine
   ↓
Camera Management
   ↓
Reports
   ↓
System Health

4. Dashboard

The Dashboard provides a high-level view of retail operations.

Key areas include:

Shopper activity
Queue conditions
Shelf status
Alerts
Operational KPIs
Recent analytics

This page demonstrates how multiple AI-generated signals can be presented through a unified retail intelligence interface.

5. Live Vision

The Live Vision page demonstrates the computer-vision processing workflow.

The current prototype uses a simulated video/analytics stream.

The interface demonstrates:

Person detection visualization
Anonymous tracking IDs
Shopper movement
Queue zones
Shelf zones
Real-time analytics
Processing status
Production Concept

In a real deployment, the simulated source would be replaced by a continuous CCTV/IP camera stream.

CCTV / IP Camera
       ↓
RTSP Stream
       ↓
Edge AI Processing
       ↓
Retail Analytics
       ↓
Dashboard

6. Shopper Analytics

This section demonstrates shopper-related intelligence such as:

Footfall
Active shoppers
Dwell time
Shopper movement
Traffic trends

7. Queue Analytics

The Queue Analytics page demonstrates:

Queue length
Waiting-time estimation
Queue status
Congestion indicators
Operational recommendations

The decision engine can generate actions based on configured thresholds.

8. Shelf Analytics

The Shelf Analytics page demonstrates shelf-level monitoring.

Current prototype functionality focuses on:

Shelf occupancy
Low-stock indicators
Shelf status
Store-level inventory signals

The current prototype does not claim SKU-level product recognition.

9. Decision Engine

The Decision Engine converts analytics into operational recommendations.

Example rules include:

High queue → recommend opening an additional counter
Severe congestion → recommend additional staff
Low shelf occupancy → generate stock-related alert
Increasing footfall → prepare additional staff capacity

These rules demonstrate how computer-vision analytics can be converted into actionable retail decisions.

10. Camera Management

The Camera Management page represents a multi-camera retail environment.

The prototype contains multiple camera sources such as:

CAM-01
CAM-02
CAM-03
CAM-04

The current sources are simulated for demonstration.

The intended deployment supports continuous CCTV/IP camera feeds through RTSP.

11. Reports

The Reports page provides summarized operational information that can be used to understand store performance over time.

12. System Health

The System Health page provides an overview of system-level indicators such as:

Processing status
Camera/source status
Inference-related metrics
System availability

13. Demo Limitations

The current SIH prototype is designed for demonstration and validation of the complete workflow.

Current limitations:

Video input is simulated
Production CCTV/RTSP integration is not enabled in the browser demo
Live YOLO inference is not claimed as part of the current frontend demo
Multi-object tracking is represented within the simulated analytics workflow
Shelf analytics currently use occupancy-based analysis rather than SKU-level recognition
Physical Edge AI hardware is not required for the demonstration
14. Target Deployment Architecture

The intended production architecture is:

Multiple CCTV / IP Cameras
            ↓
        RTSP Streams
            ↓
     Edge AI Computer
            ↓
     OpenCV Processing
            ↓
      Object Detection
            ↓
    Multi-Object Tracking
            ↓
 Shopper / Queue / Shelf Analytics
            ↓
      Decision Engine
            ↓
    Alerts & Recommendations
            ↓
      RetailEdge Dashboard

This architecture allows continuous camera feeds to be processed near the source while sending structured analytics and events to the dashboard.

15. Recommended SIH Demo Sequence

For a short demonstration:

1.Open the Dashboard
2.Navigate to Live Vision
3.Start the analysis simulation
4.Show shopper and queue activity
5.Open Shopper Analytics
6.Open Queue Analytics
7.Show Shelf Analytics
8.Open Decision Engine
9.Show Camera Management
10.Finish with Reports and System Health

The demonstration should focus on the complete flow:

Video → AI Analysis → Retail Intelligence → Decision → Action