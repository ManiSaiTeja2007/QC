"""Streamlit Interactive Wrapper embedding the 3D Three.js WebGL Studio.

IEEE TETC 2026 Paper Replication & Interactive Quantum Circuit Workbench:
"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"
"""

import sys
from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Page config
st.set_page_config(
    page_title="⚛️ Quantum ALU 3D Studio",
    page_icon="⚛️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Hide Streamlit chrome for full screen web app feel
st.markdown("""
<style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .block-container {
        padding-top: 0rem !important;
        padding-bottom: 0rem !important;
        padding-left: 0rem !important;
        padding-right: 0rem !important;
        max-width: 100% !important;
    }
</style>
""", unsafe_allow_html=True)

# Embed FastAPI 3D WebGL Workbench iframe
components.iframe("http://localhost:8000", height=950, scrolling=True)
