from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class Document:
    def __init__(self, text, path):
        self.text = text
        self.path = path


class Retriever:
    def __init__(self, documents):
        self.docs = [Document(text, path) for text, path in documents]
        self.vectorizer = TfidfVectorizer()
        self.doc_vectors = self.vectorizer.fit_transform([d.text for d in self.docs])

    def search(self, query, top_k=2):
        q_vec = self.vectorizer.transform([query])
        scores = cosine_similarity(q_vec, self.doc_vectors)[0]
        top_indices = scores.argsort()[-top_k:][::-1]
        return [self.docs[i] for i in top_indices if scores[i] > 0.01]
