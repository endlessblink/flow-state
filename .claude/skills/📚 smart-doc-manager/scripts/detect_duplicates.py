#!/usr/bin/env python3
"""
Documentation Duplicate Detector

Finds duplicate and near-duplicate documentation using:
- Content similarity analysis (TF-IDF cosine similarity)
- Exact duplicate detection via hashing
- Near-duplicate detection with configurable thresholds
- Topic overlap analysis
"""

import os
import re
import json
import hashlib
from pathlib import Path
from typing import Dict, List, Tuple, Set
from dataclasses import dataclass
from collections import Counter, defaultdict
import math

@dataclass
class DocumentInfo:
    file_path: str
    content: str
    word_count: int
    size_kb: float
    last_modified: str
    hash_md5: str

@dataclass
class DuplicateResult:
    similarity: float
    file1: str
    file2: str
    duplicate_type: str  # 'exact', 'near', 'overlap'
    differences: List[str] = None
    shared_topics: List[str] = None

class DocumentationDuplicateDetector:
    def __init__(self, docs_dir: str = "docs", similarity_threshold: float = 0.90):
        self.docs_dir = Path(docs_dir)
        self.similarity_threshold = similarity_threshold
        self.documents = []
        self.exact_duplicates = []
        self.near_duplicates = []
        self.overlapping_docs = []

    def find_documentation_files(self) -> List[Path]:
        """Find all documentation files"""
        doc_extensions = {'.md', '.rst', '.txt', '.adoc'}
        doc_files = []

        for ext in doc_extensions:
            doc_files.extend(self.docs_dir.rglob(f'*{ext}'))

        return doc_files

    def load_document(self, file_path: Path) -> DocumentInfo:
        """Load document content and metadata"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Calculate word count
            words = re.findall(r'\b\w+\b', content)
            word_count = len(words)

            # Get file size in KB
            size_kb = os.path.getsize(file_path) / 1024

            # Get last modified time
            last_modified = str(os.path.getmtime(file_path))

            # Calculate MD5 hash
            hash_md5 = hashlib.md5(content.encode('utf-8')).hexdigest()

            return DocumentInfo(
                file_path=str(file_path),
                content=content,
                word_count=word_count,
                size_kb=size_kb,
                last_modified=last_modified,
                hash_md5=hash_md5
            )

        except (UnicodeDecodeError, FileNotFoundError, PermissionError):
            return None

    def preprocess_text(self, text: str) -> str:
        """Preprocess text for similarity analysis"""
        # Convert to lowercase
        text = text.lower()

        # Remove markdown syntax
        text = re.sub(r'[#*`_\[\]()~]', ' ', text)
        text = re.sub(r'!\[.*?\]\(.*?\)', ' ', text)  # Remove images
        text = re.sub(r'\[.*?\]\(.*?\)', ' ', text)   # Remove links

        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        return text

    def extract_topics(self, text: str, max_topics: int = 10) -> List[str]:
        """Extract main topics from text using keyword frequency"""
        # Remove common stop words
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you',
            'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when',
            'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
            'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than',
            'too', 'very', 'just', 'now', 'use', 'used', 'using', 'file', 'files'
        }

        # Extract words and count frequency
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())
        word_freq = Counter(word for word in words if word not in stop_words)

        # Return top topics
        return [word for word, _ in word_freq.most_common(max_topics)]

    def calculate_cosine_similarity(self, text1: str, text2: str) -> float:
        """Calculate cosine similarity between two texts using TF-IDF"""
        # Preprocess texts
        text1 = self.preprocess_text(text1)
        text2 = self.preprocess_text(text2)

        # Create word frequency dictionaries
        words1 = text1.split()
        words2 = text2.split()

        # Get all unique words
        all_words = set(words1 + words2)

        # Create TF-IDF vectors (simplified - using term frequency only)
        tf1 = {word: words1.count(word) / len(words1) for word in all_words}
        tf2 = {word: words2.count(word) / len(words2) for word in all_words}

        # Calculate cosine similarity
        dot_product = sum(tf1[word] * tf2[word] for word in all_words)
        magnitude1 = math.sqrt(sum(tf1[word] ** 2 for word in all_words))
        magnitude2 = math.sqrt(sum(tf2[word] ** 2 for word in all_words))

        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        return dot_product / (magnitude1 * magnitude2)

    def find_exact_duplicates(self) -> List[DuplicateResult]:
        """Find exact duplicates using MD5 hashes"""
        hash_groups = defaultdict(list)

        for doc in self.documents:
            if doc:
                hash_groups[doc.hash_md5].append(doc)

        exact_duplicates = []
        for hash_value, docs in hash_groups.items():
            if len(docs) > 1:
                # Sort by last modified (newer first)
                docs.sort(key=lambda x: float(x.last_modified), reverse=True)

                # All files in this group are exact duplicates
                for i in range(1, len(docs)):
                    exact_duplicates.append(DuplicateResult(
                        similarity=1.0,
                        file1=docs[0].file_path,  # Keep the newest
                        file2=docs[i].file_path,  # This is a duplicate
                        duplicate_type='exact'
                    ))

        return exact_duplicates

    def find_near_duplicates(self) -> List[DuplicateResult]:
        """Find near-duplicates using similarity threshold"""
        near_duplicates = []
        processed = set()

        for i, doc1 in enumerate(self.documents):
            if not doc1 or i in processed:
                continue

            for j, doc2 in enumerate(self.documents[i+1:], i+1):
                if not doc2 or j in processed:
                    continue

                # Calculate similarity
                similarity = self.calculate_cosine_similarity(doc1.content, doc2.content)

                if similarity >= self.similarity_threshold:
                    # Find differences
                    differences = self.find_differences(doc1.content, doc2.content)

                    near_duplicates.append(DuplicateResult(
                        similarity=similarity,
                        file1=doc1.file_path,
                        file2=doc2.file_path,
                        duplicate_type='near',
                        differences=differences
                    ))

        return near_duplicates

    def find_overlapping_documents(self, overlap_threshold: float = 0.70) -> List[DuplicateResult]:
        """Find documents with overlapping content but below near-duplicate threshold"""
        overlapping_docs = []

        for i, doc1 in enumerate(self.documents):
            if not doc1:
                continue

            for j, doc2 in enumerate(self.documents[i+1:], i+1):
                if not doc2:
                    continue

                # Calculate similarity
                similarity = self.calculate_cosine_similarity(doc1.content, doc2.content)

                if overlap_threshold <= similarity < self.similarity_threshold:
                    # Extract topics
                    topics1 = self.extract_topics(doc1.content)
                    topics2 = self.extract_topics(doc2.content)
                    shared_topics = list(set(topics1) & set(topics2))

                    overlapping_docs.append(DuplicateResult(
                        similarity=similarity,
                        file1=doc1.file_path,
                        file2=doc2.file_path,
                        duplicate_type='overlap',
                        shared_topics=shared_topics
                    ))

        return overlapping_docs

    def find_differences(self, content1: str, content2: str) -> List[str]:
        """Find key differences between two documents"""
        differences = []

        # Split into lines for comparison
        lines1 = content1.split('\n')
        lines2 = content2.split('\n')

        # Find unique lines in each document
        set1 = set(line.strip() for line in lines1 if line.strip())
        set2 = set(line.strip() for line in lines2 if line.strip())

        unique1 = set1 - set2
        unique2 = set2 - set1

        if unique1:
            differences.append(f"Unique to file 1: {len(unique1)} lines")
            # Add some examples
            examples = list(unique1)[:3]
            for example in examples:
                differences.append(f"  - {example[:50]}...")

        if unique2:
            differences.append(f"Unique to file 2: {len(unique2)} lines")
            # Add some examples
            examples = list(unique2)[:3]
            for example in examples:
                differences.append(f"  - {example[:50]}...")

        return differences

    def analyze_duplicates(self) -> Dict:
        """Main analysis method"""
        print("🔍 Detecting duplicate documentation...")

        # Load all documents
        doc_files = self.find_documentation_files()
        print(f"📚 Found {len(doc_files)} documentation files")

        print("📖 Loading documents...")
        for doc_file in doc_files:
            doc = self.load_document(doc_file)
            if doc:
                self.documents.append(doc)

        print(f"✅ Loaded {len(self.documents)} documents successfully")

        # Find different types of duplicates
        print("🔍 Finding exact duplicates...")
        self.exact_duplicates = self.find_exact_duplicates()

        print("🔍 Finding near duplicates...")
        self.near_duplicates = self.find_near_duplicates()

        print("🔍 Finding overlapping documents...")
        self.overlapping_docs = self.find_overlapping_documents()

        # Generate summary
        total_duplicates = len(self.exact_duplicates) + len(self.near_duplicates)
        total_content_kb = sum(doc.size_kb for doc in self.documents if doc)
        duplicate_content_kb = 0

        for dup in self.exact_duplicates:
            # Get size of duplicate file (file2)
            for doc in self.documents:
                if doc and doc.file_path == dup.file2:
                    duplicate_content_kb += doc.size_kb
                    break

        for dup in self.near_duplicates:
            # Estimate 50% overlap for near duplicates
            for doc in self.documents:
                if doc and (doc.file_path == dup.file1 or doc.file_path == dup.file2):
                    duplicate_content_kb += doc.size_kb * 0.5 * dup.similarity
                    break

        # Categorize duplicates by action needed
        actions_needed = {
            'safe_to_delete': len(self.exact_duplicates),
            'review_before_merge': len(self.near_duplicates),
            'investigate_scope': len(self.overlapping_docs)
        }

        return {
            'summary': {
                'total_documents': len(self.documents),
                'total_content_kb': round(total_content_kb, 1),
                'exact_duplicates': len(self.exact_duplicates),
                'near_duplicates': len(self.near_duplicates),
                'overlapping_documents': len(self.overlapping_docs),
                'duplicate_content_kb': round(duplicate_content_kb, 1),
                'duplicate_percentage': round((duplicate_content_kb / total_content_kb * 100) if total_content_kb > 0 else 0, 1),
                'actions_needed': actions_needed
            },
            'exact_duplicates': [
                {
                    'similarity': dup.similarity,
                    'file1': dup.file1,
                    'file2': dup.file2,
                    'recommendation': 'Delete exact duplicate (keep newer version)'
                }
                for dup in self.exact_duplicates
            ],
            'near_duplicates': [
                {
                    'similarity': dup.similarity,
                    'file1': dup.file1,
                    'file2': dup.file2,
                    'differences': dup.differences[:3] if dup.differences else [],
                    'recommendation': 'Review differences and merge if appropriate'
                }
                for dup in self.near_duplicates
            ],
            'overlapping_documents': [
                {
                    'similarity': dup.similarity,
                    'file1': dup.file1,
                    'file2': dup.file2,
                    'shared_topics': dup.shared_topics[:5] if dup.shared_topics else [],
                    'recommendation': 'Investigate if they serve different purposes'
                }
                for dup in self.overlapping_docs
            ]
        }

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Detect duplicate documentation')
    parser.add_argument('--docs-dir', default='docs', help='Documentation directory')
    parser.add_argument('--threshold', type=float, default=0.90, help='Similarity threshold for near duplicates')
    parser.add_argument('--output', help='Output JSON file path')
    parser.add_argument('--pretty', action='store_true', help='Pretty print JSON output')

    args = parser.parse_args()

    detector = DocumentationDuplicateDetector(args.docs_dir, args.threshold)
    result = detector.analyze_duplicates()

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2 if args.pretty else None)
        print(f"✅ Results saved to: {args.output}")
    else:
        print(json.dumps(result, indent=2 if args.pretty else None))

if __name__ == "__main__":
    main()