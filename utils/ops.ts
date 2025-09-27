const hiccupsCount = new Map<string, number>();

export const addHiccup = (key: string) => {
    if (!hiccupsCount.has(key)) {
        hiccupsCount.set(key, 0);
    }

    hiccupsCount.set(key, hiccupsCount.get(key)! + 1);
}

export const getHiccupsCount = (key: string) => {
    return hiccupsCount.get(key) || 0;
}

export const resetHiccupsCount = (key: string) => {
    hiccupsCount.set(key, 0);
}