# Model weights

The English checkpoint (`convaiinnovations/laya` root: ModernBERT-large, 421M parameters, 843 MB
`model.safetensors`) is attached to this repository's GitHub release **weights-v1** rather than committed
to git, because GitHub rejects files over 100 MB and Git LFS bandwidth quotas would break public downloads.

```bash
./models/download.sh            # → models/laya-english
```

The `multilingual` (644 MB) and `typed-decisions` (843 MB) checkpoints are fetched from
Hugging Face on first use by the `laya` package (`convaiinnovations/laya`, subfolders).

Fine-tuned models produced by `training/finetune.py` are written here too (`models/<name>/`).
The folder `laya-english/` is git-ignored.
