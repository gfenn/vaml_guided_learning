import os
import numpy as np


ROOT_FOLDER = '../../../thesis_data'
RAW_DATA_FOLDER = ROOT_FOLDER + '/raw/validation'
CONVERTED_FOLDER = ROOT_FOLDER + '/validation'


def load_all_data(folder):
    all_files = os.listdir(folder)
    cache = {}
    for filename in all_files:
        tokens = filename.replace('.npy', '').split('_')

        # Get the sample set from the data cache
        if tokens[1] not in cache:
            # cache[tokens[1]] = [0 for _ in range(300)]
            cache[tokens[1]] = np.zeros((300, 40))
        sample_set = cache[tokens[1]]

        # Store the data into the set
        step = int(int(tokens[2]) / 10000 - 1)
        sample_set[step] = np.load(os.path.join(folder, filename))
    return cache


def save_all_data(folder, data):
    for key in data:
        np.save(os.path.join(folder, 'predictions_{}.npy'.format(key)), data[key])


if __name__ == '__main__':
    print("Converting validation data")
    all_data = load_all_data(RAW_DATA_FOLDER)
    save_all_data(CONVERTED_FOLDER, all_data)
