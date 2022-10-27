import java.math.BigInteger;

/**
 * PACKAGE_NAME.null.java
 * kotlin-coroutine
 *
 * @author 寒雨
 * @since 2022/10/23 下午7:55
 */
public class Test {

    public static void main(String[] args) {

        for (int m = 1; m <= 9; m++) {
            for (int n = 1; n <= m; n++) {
                System.out.print(m + " * " + n + " = " + (m * n) + " ");
            }
            System.out.println();
        }
    }
}
