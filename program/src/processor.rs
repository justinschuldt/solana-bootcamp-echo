use borsh::{BorshDeserialize};

use solana_program::{
    entrypoint::ProgramResult, msg, program_error::ProgramError,
    account_info::next_account_info,
    pubkey::Pubkey,
};
use solana_program::account_info::AccountInfo;

use crate::error::EchoError;
use crate::instruction::EchoInstruction;

pub struct Processor {}

impl Processor {
    pub fn process_instruction(
        _program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = EchoInstruction::try_from_slice(instruction_data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        match instruction {
            EchoInstruction::Echo { data: message_vec } => {
                msg!("Instruction: Echo");

                let accounts_iter = &mut accounts.iter();
                let user_account = next_account_info(accounts_iter)?;

                // Checking if hello state account is writable
                if !user_account.is_writable {
                    return Err(ProgramError::InvalidAccountData);
                }

                // check the message will fit in account data,
                // trim if needed.
                let len = user_account.data_len();
                let message_len = message_vec.len();
                let mut trimmed_message = message_vec; 
                if message_len > len {
                    trimmed_message = trimmed_message[0..len].to_vec();
                }

                // write message to account
                let buffer = &mut user_account.data.borrow_mut();
                buffer.copy_from_slice(&trimmed_message);

                msg!("message written to account");

                Ok(())
            }
            EchoInstruction::InitializeAuthorizedEcho {
                buffer_seed: _,
                buffer_size: _,
            } => {
                msg!("Instruction: InitializeAuthorizedEcho");
                Err(EchoError::NotImplemented.into())
            }
            EchoInstruction::AuthorizedEcho { data: _ } => {
                msg!("Instruction: AuthorizedEcho");
                Err(EchoError::NotImplemented.into())
            }
            EchoInstruction::InitializeVendingMachineEcho {
                price: _,
                buffer_size: _,
            } => {
                msg!("Instruction: InitializeVendingMachineEcho");
                Err(EchoError::NotImplemented.into())
            }
            EchoInstruction::VendingMachineEcho { data: _ } => {
                msg!("Instruction: VendingMachineEcho");
                Err(EchoError::NotImplemented.into())
            }
        }
    }
}
