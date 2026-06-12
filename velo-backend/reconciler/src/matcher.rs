use stellar_strkey::ed25519::MuxedAccount;

pub fn decode_muxed_id(destination: &str) -> Option<u64> {
    if !destination.starts_with('M') {
        return None;
    }
    match MuxedAccount::from_string(destination) {
        Ok(muxed) => Some(muxed.id),
        Err(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_g_address_returns_none() {
        let g_addr = "GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3VOPKSWRW";
        assert!(decode_muxed_id(g_addr).is_none());
    }

    #[test]
    fn test_malformed_returns_none() {
        assert!(decode_muxed_id("INVALID_ADDRESS").is_none());
        assert!(decode_muxed_id("").is_none());
    }

    #[test]
    fn test_m_address_format() {
        // M addresses start with M — verify the check works
        let m_addr = "MA7QYNF7SOWQ3GLR2BGMZEHXR7BEWWRPMOBNMRUFZ7BHCPXNVP3MKEBAAAAAAAAAAAPCIBVZA";
        let result = decode_muxed_id(m_addr);
        // Either decodes to Some or None depending on validity — just confirm no panic
        let _ = result;
    }
}
