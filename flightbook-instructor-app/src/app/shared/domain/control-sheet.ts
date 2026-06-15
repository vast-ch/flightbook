import { AltitudeFlight } from "./altitude-flight";
import { Level } from "./level";
import { Theory } from "./theory";
import { TrainingHill } from "./training-hill";
import { User } from "./user";

export class ControlSheet {
  public id: number | undefined;
  public userCanEdit: boolean | undefined;
  public passTheoryExam: Date | undefined;
  public passPracticeExam: Date | undefined;
  public user: User | undefined;
  public trainingHill: TrainingHill | undefined;
  public theory: Theory | undefined;
  public altitudeFlight: AltitudeFlight | undefined;
  public level: Level | undefined;
}
