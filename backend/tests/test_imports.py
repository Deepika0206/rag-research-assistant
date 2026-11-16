import numpy as np
import psycopg
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer

def test_imports():
    print("NumPy version:", np.__version__)
    print("Psycopg version:", psycopg.__version__)
    print("pgvector register_vector:", register_vector.__name__)
    print("SentenceTransformer:", SentenceTransformer.__name__)
    print("SUCCESS: All required imports are available!")

if __name__ == "__main__":
    test_imports()

    