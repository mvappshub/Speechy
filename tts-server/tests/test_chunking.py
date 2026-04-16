import unittest
from pathlib import Path

import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from domain.text_chunking import split_text_into_chunks


class SplitTextIntoChunksTests(unittest.TestCase):
    def test_returns_empty_list_for_blank_input(self):
        self.assertEqual(split_text_into_chunks("   \n\n "), [])

    def test_groups_multiple_sentences_until_limit(self):
        text = (
            "Prvni veta je kratka. Druha veta je taky kratka. "
            "Treti veta uz vytvori dalsi blok."
        )
        chunks = split_text_into_chunks(text, max_chars=60)
        self.assertEqual(
            chunks,
            [
                "Prvni veta je kratka. Druha veta je taky kratka.",
                "Treti veta uz vytvori dalsi blok.",
            ],
        )

    def test_preserves_paragraph_boundary(self):
        text = "Prvni odstavec. Druha veta.\n\nNovy odstavec zacina tady."
        chunks = split_text_into_chunks(text, max_chars=120)
        self.assertEqual(
            chunks,
            [
                "Prvni odstavec. Druha veta.",
                "Novy odstavec zacina tady.",
            ],
        )

    def test_splits_oversized_sentence_without_dropping_words(self):
        text = (
            "Toto je mimoradne dlouha veta, ktera ma vice casti, a proto se musi "
            "bezpecne rozdelit na mensi useky pro stabilni generovani audia."
        )
        chunks = split_text_into_chunks(text, max_chars=55)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(chunk) <= 55 for chunk in chunks))
        self.assertIn("stabilni generovani audia.", chunks[-1])
