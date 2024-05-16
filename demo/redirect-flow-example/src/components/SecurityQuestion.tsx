import { useState } from "react";
import { TssSecurityQuestion, TssShareType, Web3AuthMPCCoreKit } from "@web3auth/mpc-core-kit";


interface ISecurityQuestionProps {
  // createSecurityQuestion: (question: string, answer: string) => void;
  // changeSecurityQuestion: (question: string, newAnswer: string, oldAnswer: string) => void;
  // deleteSecurityQuestion: () => void;
  coreKitInstance: Web3AuthMPCCoreKit
}

const SecurityQuestion = ({ coreKitInstance }: ISecurityQuestionProps) => {
  const securityQuestion: TssSecurityQuestion = new TssSecurityQuestion();

  const [question, setQuestion] = useState<string | undefined>(undefined);
  const [newQuestion, setNewQuestion] = useState<string | undefined>(undefined);
  const [answer, setAnswer] = useState<string | undefined>(undefined);
  const [newAnswer, setNewAnswer] = useState<string | undefined>(undefined);

  const createSecurityQuestion = async (question: string, answer: string) => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await securityQuestion.setSecurityQuestion({ mpcCoreKit: coreKitInstance, question, answer, shareType: TssShareType.RECOVERY });
    setNewQuestion(undefined);
    let result = securityQuestion.getQuestion(coreKitInstance);
    if (result) {
      setQuestion(question);
    }
  }

  const changeSecurityQuestion = async (newQuestion: string, newAnswer: string, answer: string) => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await securityQuestion.changeSecurityQuestion({ mpcCoreKit: coreKitInstance, newQuestion, newAnswer, answer });
    let result = securityQuestion.getQuestion(coreKitInstance);
    if (result) {
      setQuestion(question);
    }
  }

  const deleteSecurityQuestion = async () => {
    if (!coreKitInstance) {
      throw new Error("coreKitInstance is not set");
    }
    await securityQuestion.deleteSecurityQuestion(coreKitInstance);
    setQuestion(undefined);
  }

  return (
    <>
      <h4>Security Question</h4>

      <div>{question}</div>
      <div className="flex-container">
        <div className={question ? " disabledDiv" : ""}>
          <label>Set Security Question:</label>
          <input value={question} placeholder="question" onChange={(e) => setNewQuestion(e.target.value)}></input>
          <input value={answer} placeholder="answer" onChange={(e) => setAnswer(e.target.value)}></input>
          <button onClick={() => createSecurityQuestion(newQuestion!, answer!)} className="card">
            Create Security Question
          </button>
        </div>

        <div className={!question ? " disabledDiv" : ""}>
          <label>Change Security Question:</label>
          <input value={newQuestion} placeholder="newQuestion" onChange={(e) => setNewQuestion(e.target.value)}></input>
          <input value={newAnswer} placeholder="newAnswer" onChange={(e) => setNewAnswer(e.target.value)}></input>
          <input value={answer} placeholder="oldAnswer" onChange={(e) => setAnswer(e.target.value)}></input>
          <button onClick={() => changeSecurityQuestion(newQuestion!, newAnswer!, answer!)} className="card">
            Change Security Question
          </button>

        </div>
      </div>
      <div className="flex-container">
        <div className={!question ? "disabledDiv" : ""}>
          <button onClick={() => deleteSecurityQuestion()} className="card">
            Delete Security Question
          </button>
        </div>
      </div>
    </>
  )
}

export default SecurityQuestion;
