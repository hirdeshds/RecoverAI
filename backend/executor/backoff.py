import time

def calculate_backoff(attempt: int, base_delay: int = 2) -> int:
    """Calculates exponential backoff delay in seconds."""
    return base_delay ** attempt

def execute_with_backoff(func, *args, max_retries: int = 3, **kwargs):
    """Executes a function retrying on 429 rate limit exceptions with exponential backoff."""
    for attempt in range(1, max_retries + 1):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            if "429" in str(e) and attempt < max_retries:
                sleep_time = calculate_backoff(attempt)
                time.sleep(sleep_time)
            else:
                raise e
