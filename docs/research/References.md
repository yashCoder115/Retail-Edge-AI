&#x20;# References



This file contains the technical and research references used for the RetailEdge AI prototype and its proposed production architecture.



\---



\## 1. Computer Vision



\### OpenCV

OpenCV is used as the primary computer vision framework for video processing, frame handling, image operations, and camera-stream integration.



\- Official Documentation: https://docs.opencv.org/

\- Official Website: https://opencv.org/



\---



\## 2. Object Detection



\### Ultralytics YOLO

YOLO is considered for real-time object detection in the production Edge AI pipeline.



\- Documentation: https://docs.ultralytics.com/

\- GitHub: https://github.com/ultralytics/ultralytics



\---



\## 3. Multi-Object Tracking



\### ByteTrack

ByteTrack is considered for maintaining anonymous object track IDs across video frames.



\- Paper: https://arxiv.org/abs/2110.06864

\- GitHub: https://github.com/ifzhang/ByteTrack



\### BoT-SORT

BoT-SORT is another tracking approach considered for multi-object tracking in the production pipeline.



\- Paper: https://arxiv.org/abs/2206.14651

\- GitHub: https://github.com/NirAharon/BoT-SORT



\---



\## 4. Edge AI Hardware



\### NVIDIA Jetson

NVIDIA Jetson platforms are considered as a target edge-computing platform for deploying computer vision inference close to retail cameras.



\- NVIDIA Jetson: https://developer.nvidia.com/embedded/jetson

\- Jetson Documentation: https://docs.nvidia.com/jetson/



\---



\## 5. Backend



\### FastAPI

FastAPI is used in the prototype backend for providing APIs and communication between the analytics layer and dashboard.



\- Official Documentation: https://fastapi.tiangolo.com/



\---



\## 6. Frontend



\### React

React is used to build the RetailEdge AI dashboard and visualization interface.



\- Official Documentation: https://react.dev/



\### Recharts

Recharts is used for displaying analytics and KPI visualizations in the dashboard.



\- Official Documentation: https://recharts.org/



\---



\## 7. Video Streaming



\### RTSP

RTSP is considered as the communication protocol for receiving continuous video streams from CCTV/IP cameras in the proposed deployment architecture.



The production architecture is designed around:



CCTV / IP Camera → RTSP Stream → Edge Computer → AI Processing → Dashboard



\---



\## 8. Privacy \& Edge Processing



The architecture follows an edge-first approach in which video processing can be performed locally near the camera source.



Key principles:



\- Minimize transmission of raw video

\- Use anonymous tracking identifiers

\- Avoid facial recognition

\- Share only required analytics and events

\- Keep cloud synchronization optional



\---



\## 9. Research Papers



\### ByteTrack: Multi-Object Tracking by Associating Every Detection Box

Z. Zhang et al.



https://arxiv.org/abs/2110.06864



\### BoT-SORT: Robust Associations Multi-Pedestrian Tracking

N. Aharon et al.



https://arxiv.org/abs/2206.14651



\---



\## 10. Reference Usage



These references support the technical direction of the RetailEdge AI system.



They are used for:



\- Computer vision processing

\- Real-time object detection

\- Multi-object tracking

\- Edge AI deployment

\- Camera-stream processing

\- Backend API development

\- Dashboard development



The current prototype uses simulated streams for demonstration. The referenced technologies represent the intended production-oriented implementation path and are not all claimed as fully integrated into the current prototype.


