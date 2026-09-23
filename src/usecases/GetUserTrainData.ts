import {NotFoundError} from "../errors/index.js";
import {prisma} from "../lib/db.js";

interface InputDto {
  userId: string;
}

interface OutputDto {
  userId: string;
  userName: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number; // 100 representa 100%
}

export class GetUserTrainData {
  async execute(dto: InputDto): Promise<OutputDto | null> {
    const user = await prisma.user.findUnique({
      where: {id: dto.userId},
    });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const {weightInGrams, heightInCentimeters, age, bodyFatPercentage} = user;
    if (weightInGrams === null || heightInCentimeters === null || age === null || bodyFatPercentage === null) {
      return null;
    }

    return {
      userId: user.id,
      userName: user.name,
      weightInGrams,
      heightInCentimeters,
      age,
      bodyFatPercentage,
    };
  }
}
