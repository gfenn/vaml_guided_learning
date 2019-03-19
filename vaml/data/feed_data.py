
import os
import json
import time
import numpy as np
from shutil import copyfile


RUN_METADATA_FORMAT = '{folder}/run_{id}_metadata.json'
RUN_REWARDS_FORMAT = '{folder}/run_{id}_rewards.npy'
EP_METADATA_FORMAT = '{folder}/episode_{id}_meta.json'
EP_REWARDS_FORMAT = '{folder}/episode_{id}_rewards.npy'


class DataFeeder:

    def __init__(self, src_folder, dst_folder, old_run_id, new_run_id):
        self.src_folder = src_folder
        self.dst_folder = dst_folder
        self.run_id = new_run_id
        self.old_run_id = old_run_id
        self.episode_id = 1
        self.step_count = 0
        self.data = None

    def _load_episode_metadata(self):
        filename = EP_METADATA_FORMAT.format(
            folder=self.src_folder,
            id=self.episode_id
        )
        with open(filename, 'r') as fh:
            metadata = json.load(fh)

        metadata['run'] = self.run_id
        return metadata

    def _save_episode_metadata(self, metadata):
        filename = EP_METADATA_FORMAT.format(
            folder=self.dst_folder,
            id=self.episode_id
        )
        with open(filename, 'w') as fh:
            json.dump(metadata, fh)

    def _load_episode_rewards(self):
        filename = EP_REWARDS_FORMAT.format(
            folder=self.src_folder,
            id=self.episode_id
        )
        return np.load(filename)

    def _save_episode_rewards(self, rewards):
        filename = EP_REWARDS_FORMAT.format(
            folder=self.dst_folder,
            id=self.episode_id
        )
        np.save(filename, rewards)

    def _copy_run_metadata(self):
        src = RUN_METADATA_FORMAT.format(folder=self.src_folder, id=self.old_run_id)
        dst = RUN_METADATA_FORMAT.format(folder=self.dst_folder, id=self.run_id)
        copyfile(src, dst)

    def _save_run_metadata(self):
        dst = RUN_METADATA_FORMAT.format(folder=self.dst_folder, id=self.run_id)
        meta = {
            'episodes': self.episode_id,
            'total_reward': np.sum(self.data),
            'total_steps': self.data.size
        }
        with open(dst, 'w') as fh:
            json.dump(meta, fh)

    def _copy_run_rewards(self):
        src = RUN_REWARDS_FORMAT.format(folder=self.src_folder, id=self.old_run_id)
        dst = RUN_REWARDS_FORMAT.format(folder=self.dst_folder, id=self.run_id)
        copyfile(src, dst)

    def _save_run_rewards(self):
        dst = RUN_REWARDS_FORMAT.format(folder=self.dst_folder, id=self.run_id)
        np.save(dst, self.data)

    def _episode_iterator(self):
        while True:
            try:
                metadata = self._load_episode_metadata()
                rewards = self._load_episode_rewards()
                yield metadata, rewards
                self.episode_id += 1
            except:
                break

    def feed(self, ep_delay):
        # Process all episodes
        for metadata, rewards in self._episode_iterator():
            print("Converting episode " + str(self.episode_id))
            self._save_episode_metadata(metadata)
            self._save_episode_rewards(rewards)
            if ep_delay is not None:
                # Append to current data
                if self.data is None:
                    self.data = rewards
                else:
                    self.data = np.concatenate((self.data, rewards))

                # Save run-level info
                self._save_run_metadata()
                self._save_run_rewards()
                # Sleep
                time.sleep(ep_delay)

        # Save the run data if not already
        if ep_delay is None:
            self._copy_run_metadata()
            self._copy_run_rewards()


def _determine_next_run_id(data_folder):
    highest_id = 0
    for folder in os.listdir(data_folder):
        try:
            run_number = int(folder.split('_')[1])
            highest_id = max(highest_id, run_number)
        except:
            pass
    return highest_id + 1


def feed_folder(data_folder, feed_run, ep_delay):
    # First we need to determine the next run id
    next_run_id = _determine_next_run_id(data_folder)
    src_folder = '{data_folder}/TOO_FEED/run_{feed_run}'.format(
        data_folder=data_folder,
        feed_run=feed_run
    )
    dst_folder = '{data_folder}/run_{run_id}'.format(
        data_folder=data_folder,
        run_id=next_run_id
    )

    # Make the dst folder
    os.mkdir(dst_folder)

    # Create and run
    DataFeeder(src_folder, dst_folder, feed_run, next_run_id).feed(ep_delay)


if __name__ == '__main__':
    feed_folder(data_folder='../../../thesis_data', feed_run=6, ep_delay=0.2)
