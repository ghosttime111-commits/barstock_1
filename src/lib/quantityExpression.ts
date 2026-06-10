const NUMBER_PART_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export function parseQuantityExpression(input: string): number {
  const expression = input.trim();
  if (!expression) {
    throw new Error("Введите количество");
  }

  const parts = expression.split("+").map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) {
    throw new Error("Некорректное выражение");
  }

  const total = parts.reduce((sum, part) => {
    if (!NUMBER_PART_PATTERN.test(part)) {
      throw new Error("Некорректное выражение");
    }

    const value = Number(part);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Некорректное выражение");
    }

    return sum + value;
  }, 0);

  return Math.round(total * 1_000_000_000_000) / 1_000_000_000_000;
}
