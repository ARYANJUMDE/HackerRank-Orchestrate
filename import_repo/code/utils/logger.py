def init_log(file):
    with open(file, "w") as f:
        f.write("")


def log_step(file, text):
    with open(file, "a") as f:
        f.write(text + "\n")
