use borsh::{BorshDeserialize, BorshSerialize};

use solana_program::{
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    account_info::next_account_info,
    pubkey::Pubkey,
    system_instruction,
    program::{invoke_signed},
    system_program::ID as SYSTEM_PROGRAM_ID,
    sysvar::{rent::Rent, Sysvar},
};
use solana_program::account_info::AccountInfo;

use crate::error::EchoError;
use crate::instruction::EchoInstruction;
use crate::state::AuthorizedBufferHeader;

pub fn assert_with_msg(statement: bool, err: ProgramError, msg: &str) -> ProgramResult {
    if !statement {
        msg!(msg);
        Err(err)
    } else {
        Ok(())
    }
}

pub struct Processor {}

impl Processor {
    pub fn process_instruction(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = EchoInstruction::try_from_slice(instruction_data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        match instruction {
            EchoInstruction::Echo { data: mut message_vec } => {
                msg!("Instruction: Echo");

                let accounts_iter = &mut accounts.iter();
                let user_account = next_account_info(accounts_iter)?;

                // Checking if hello state account is writable
                if !user_account.is_writable {
                    return Err(ProgramError::InvalidAccountData);
                }

                let buffer = &mut user_account.data.borrow_mut();

                assert_with_msg(
                    buffer.len() > 0,
                    ProgramError::InvalidArgument,
                    "Account is not initialized.",
                )?;

                assert_with_msg(
                    buffer[0] == 0,
                    ProgramError::InvalidArgument,
                    "Account data is not empty.",
                )?;

                assert_with_msg(
                    user_account.lamports() > 0,
                    ProgramError::InvalidArgument,
                    "lamports is not > 0.",
                )?;

                // check the message will fit in account data,
                // trim if needed.
                let len = buffer.len();
                let message_len = message_vec.len();
                if message_len > len {
                    msg!("trimming message to length {}", len);
                    message_vec.truncate(len);
                } else if len > message_len {
                    msg!("length of data is longer than message length.");
                    message_vec.resize(len, 0);
                }

                // write message to account
                buffer.copy_from_slice(&message_vec);

                msg!("message written to account");

                Ok(())
            }
            EchoInstruction::InitializeAuthorizedEcho {
                // buffer_seed,
                // buffer_size,
            } => {
                let buffer_seed: u64 = 123456;
                let buffer_size: usize = 124;
                msg!("Instruction: InitializeAuthorizedEcho {} {}",buffer_seed, buffer_size);

                let accounts_iter = &mut accounts.iter();

                let authorized_buffer_ai = next_account_info(accounts_iter)?;
                msg!("authorized_buffer_ai.key {}", authorized_buffer_ai.key);
                let authority = next_account_info(accounts_iter)?;
                msg!("authority.key {}", authority.key);
                let system_program = next_account_info(accounts_iter)?;

                msg!("authority {:?}", b"authority");
                msg!("&buffer_seed.to_le_bytes() {:?}", buffer_seed.to_le_bytes());
                let (authorized_buffer_key, bump_seed) = Pubkey::find_program_address(
                    &[
                        b"authority",
                        authority.key.as_ref(),
                        &buffer_seed.to_le_bytes()
                    ],
                    program_id,
                );
                msg!("authorized_buffer_key {}", authorized_buffer_key);
                msg!("bump_seed {}", bump_seed);

        
                let auth_pubkey = Pubkey::create_program_address(
                    &[
                        b"authority",
                        authority.key.as_ref(),
                        &buffer_seed.to_le_bytes(),
                        &[bump_seed]
                    ], 
                    program_id
                )?;
                msg!("created program address: {}", auth_pubkey);

                if *authorized_buffer_ai.key != authorized_buffer_key {
                    // allocated key does not match the derived address
                    return Err(ProgramError::InvalidArgument);
                }
        
                // invoke: use when no PDAs
                // invoke_signed: use when PDAs sign
                msg!("going to invoke_signed");
                let res = invoke_signed(
                    &system_instruction::create_account(
                        authority.key,
                        &authorized_buffer_key,
                        Rent::get()?.minimum_balance(buffer_size),
                        buffer_size.try_into().unwrap(),
                        program_id,
                    ),
                    &[authority.clone(), authorized_buffer_ai.clone(), system_program.clone()],
                    &[&[b"authority", authority.key.as_ref(), &buffer_seed.to_le_bytes(), &[bump_seed]]],
                );
                msg!("invoke_signed res {:?}", res);
    
                assert_with_msg(
                    *system_program.key == SYSTEM_PROGRAM_ID,
                    ProgramError::InvalidArgument,
                    "Invalid passed in for system program",
                )?;

                let mut auth_buff_header = AuthorizedBufferHeader::try_from_slice(&authorized_buffer_ai.data.borrow()[0..9])?;
                auth_buff_header.bump_seed = bump_seed;
                auth_buff_header.buffer_seed = buffer_seed;
                auth_buff_header.serialize(&mut *authorized_buffer_ai.data.borrow_mut())?;

                msg!("Done initalizing AuthorizedEcho");
                Ok(())
            }
            EchoInstruction::AuthorizedEcho { data: mut message_vec } => {
                msg!("Instruction: AuthorizedEcho");
                let accounts_iter = &mut accounts.iter();

                let authorized_buffer_ai = next_account_info(accounts_iter)?;
                msg!("authorized_buffer_ai.key {}", authorized_buffer_ai.key);
                let authority = next_account_info(accounts_iter)?;
                msg!("authority.key {}", authority.key);

                let auth_buff_header = AuthorizedBufferHeader::try_from_slice(&authorized_buffer_ai.data.borrow()[0..9])?;
                let bump_seed = auth_buff_header.bump_seed;
                let buffer_seed = auth_buff_header.buffer_seed;
                msg!("bump_seed {}", bump_seed);
                msg!("buffer_seed {}", buffer_seed);

                let auth_pubkey = Pubkey::create_program_address(
                    &[
                        b"authority",
                        authority.key.as_ref(),
                        &buffer_seed.to_le_bytes(),
                        &[bump_seed]
                    ], 
                    program_id
                )?;

                msg!("authorized_buffer_ai.key {}", authorized_buffer_ai.key);
                msg!("derived auth_pubkey {}", auth_pubkey);

                assert_with_msg(
                    *authorized_buffer_ai.key == auth_pubkey,
                    ProgramError::InvalidArgument,
                    "Invalid PDA seeds for authority",
                )?;


                let message_buffer = &mut authorized_buffer_ai.data.borrow_mut()[9..];
                let message_buffer_len = message_buffer.len();
                msg!("message_buffer_len {}", message_buffer_len);

                let message_len = message_vec.len();
                msg!("message_len {}", message_len);

                if message_len > message_buffer_len {
                    msg!("truncating message to length {}", message_buffer_len);
                    message_vec.truncate(message_buffer_len);

                } else if message_buffer_len > message_len {
                    msg!("length of existing message is longer than new message length.");

                    message_vec.resize(message_buffer_len, 0);
                }
                
                message_buffer.copy_from_slice(&message_vec);
                msg!("wrote message_vec to message_buffer!");

                Ok(())
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
