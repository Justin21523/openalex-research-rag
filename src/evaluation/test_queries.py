"""Hand-crafted evaluation queries tied to work IDs in works_sample.json."""

TEST_QUERIES: list[dict] = [
    {
        "query": "transformer architecture attention mechanism deep learning",
        "relevant_work_ids": {"W3177318507", "W2964110616", "W4376226279"},
        "description": "Transformer architecture papers",
    },
    {
        "query": "BERT language model pretraining sentence embeddings",
        "relevant_work_ids": {"W2970641574", "W2970771982", "W3046375318"},
        "description": "BERT and language model pretraining",
    },
    {
        "query": "graph neural networks node classification knowledge graph",
        "relevant_work_ids": {"W2519887557", "W2963911286"},
        "description": "Graph neural networks and knowledge graphs",
    },
    {
        "query": "retrieval augmented generation question answering",
        "relevant_work_ids": set(),
        "description": "RAG systems",
    },
    {
        "query": "citation network academic scholarly analysis",
        "relevant_work_ids": {"W2519887557"},
        "description": "Citation network analysis",
    },
    {
        "query": "sentence transformers semantic similarity text embeddings",
        "relevant_work_ids": {"W2970641574"},
        "description": "Sentence embedding models",
    },
    {
        "query": "biomedical NLP text mining scientific literature",
        "relevant_work_ids": {"W2911489562", "W2970771982"},
        "description": "Biomedical text mining",
    },
    {
        "query": "image recognition convolutional neural networks deep learning",
        "relevant_work_ids": {"W2112796928"},
        "description": "Image recognition with deep learning",
    },
    {
        "query": "pretraining self-supervised BERT XLNet language representation",
        "relevant_work_ids": {"W2950813464", "W2975059944"},
        "description": "Self-supervised language pretraining",
    },
    {
        "query": "vision transformer image classification segmentation",
        "relevant_work_ids": {"W3175515048", "W3157528469"},
        "description": "Vision transformers",
    },
]
