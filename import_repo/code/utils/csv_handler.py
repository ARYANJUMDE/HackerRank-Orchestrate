import csv

def write_output(file_path, rows):
    with open(file_path, "w", newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        # ✅ Correct header (VERY IMPORTANT)
        writer.writerow([
            "issue",
            "subject",
            "company",
            "response",
            "product_area",
            "status",
            "request_type",
            "justification"
        ])

        # write rows
        for row in rows:
            writer.writerow(row)